package pg

import (
	"context"
	"strings"
	"time"

	"github.com/AndrewK4758/aklapper/packages/go/kit/agensi"
)

type CommitAgensiSyncInput struct {
	CreatorHandle      string
	TTLSeconds         int
	ForceRefresh       bool
	NotModified        bool
	Items              []agensi.Skill
	ETag               string
	FetchedAt          time.Time
	PreFetchLastSynced *time.Time
	CorrelationID      string
	StartedAt          time.Time
}

type CommitAgensiSyncResult struct {
	CreatorHandle     string
	SyncState         AgensiSyncStateRecord
	Skills            []agensi.Skill
	NotModified       bool
	SyncedCount       int
	DeactivatedCount  int
	StaleWriteSkipped bool
}

// CommitAgensiSyncTx serializes concurrent Go Portal and Node Admin Agensi syncs via
// SELECT ... FROM agensi_sync_state WHERE creator_handle = $1 FOR UPDATE + post-lock re-validation.
func (s *Store) CommitAgensiSyncTx(ctx context.Context, in CommitAgensiSyncInput) (CommitAgensiSyncResult, error) {
	if s == nil || s.pool == nil {
		return CommitAgensiSyncResult{
			CreatorHandle: in.CreatorHandle,
			SyncState:     defaultSyncState(in.CreatorHandle),
			Skills:        in.Items,
		}, nil
	}
	fetchedAt := in.FetchedAt
	if fetchedAt.IsZero() {
		fetchedAt = time.Now().UTC()
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return CommitAgensiSyncResult{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if _, err := tx.Exec(
		ctx,
		`INSERT INTO agensi_sync_state (creator_handle, last_status, item_count)
		 VALUES ($1, 'idle', 0)
		 ON CONFLICT (creator_handle) DO NOTHING`,
		in.CreatorHandle,
	); err != nil {
		return CommitAgensiSyncResult{}, err
	}

	var lockedHandle string
	var postLockLastSynced *time.Time
	if err := tx.QueryRow(
		ctx,
		`SELECT creator_handle, last_synced_at
		 FROM agensi_sync_state
		 WHERE creator_handle = $1
		 FOR UPDATE`,
		in.CreatorHandle,
	).Scan(&lockedHandle, &postLockLastSynced); err != nil {
		return CommitAgensiSyncResult{}, err
	}

	committedWhileFetching := postLockLastSynced != nil && !equalOptionalTimes(postLockLastSynced, in.PreFetchLastSynced)
	isSuperseded := committedWhileFetching && !postLockLastSynced.Before(fetchedAt)
	isFreshByConcurrent := committedWhileFetching &&
		!in.ForceRefresh &&
		in.TTLSeconds > 0 &&
		time.Since(*postLockLastSynced) < time.Duration(in.TTLSeconds)*time.Second

	if isSuperseded || isFreshByConcurrent {
		emitPortalPGSeam("UNSOUND_CONDITION", "agensi.cache.stale_write_skipped", map[string]any{
			"correlationId": in.CorrelationID,
			"creatorHandle": in.CreatorHandle,
		})
		curState, err := readAgensiSyncStateWith(ctx, tx, in.CreatorHandle)
		if err != nil {
			return CommitAgensiSyncResult{}, err
		}
		curSkills, err := queryCreatorPublishedAgensiSkillsWith(ctx, tx, in.CreatorHandle)
		if err != nil {
			return CommitAgensiSyncResult{}, err
		}
		if err := tx.Commit(ctx); err != nil {
			return CommitAgensiSyncResult{}, err
		}
		st := defaultSyncState(in.CreatorHandle)
		if curState != nil {
			st = *curState
		}
		return CommitAgensiSyncResult{
			CreatorHandle:     in.CreatorHandle,
			SyncState:         st,
			Skills:            curSkills,
			NotModified:       in.NotModified,
			StaleWriteSkipped: true,
		}, nil
	}

	syncedCount := 0
	deactivatedCount := 0
	if !in.NotModified {
		includeNullCreator := strings.EqualFold(strings.TrimSpace(in.CreatorHandle), "aklapper")
		activeSlugs := make([]string, 0, len(in.Items))
		for _, item := range in.Items {
			activeSlugs = append(activeSlugs, item.Slug)
		}

		ownershipClause := `lower(creator_handle) = lower($2)`
		if includeNullCreator {
			ownershipClause = `(lower(creator_handle) = lower($2) OR creator_handle IS NULL)`
		}
		var pruneSQL string
		var pruneArgs []any
		if len(activeSlugs) > 0 {
			pruneSQL = `UPDATE agensi_skills
				SET is_published = false, synced_at = $1
				WHERE ` + ownershipClause + `
				  AND source IN ('agensi_api', 'seed')
				  AND is_published = true
				  AND NOT (slug = ANY($3))`
			pruneArgs = []any{fetchedAt, in.CreatorHandle, activeSlugs}
		} else {
			pruneSQL = `UPDATE agensi_skills
				SET is_published = false, synced_at = $1
				WHERE ` + ownershipClause + `
				  AND source IN ('agensi_api', 'seed')
				  AND is_published = true`
			pruneArgs = []any{fetchedAt, in.CreatorHandle}
		}
		tag, err := tx.Exec(ctx, pruneSQL, pruneArgs...)
		if err != nil {
			return CommitAgensiSyncResult{}, err
		}
		deactivatedCount = int(tag.RowsAffected())

		for _, item := range in.Items {
			tags := item.Tags
			if tags == nil {
				tags = []string{}
			}
			if _, err := tx.Exec(
				ctx,
				`INSERT INTO agensi_skills
				 (slug, name, summary, tags, url, sort_order, creator_handle, is_published, synced_at, source)
				 VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8, 'agensi_api')
				 ON CONFLICT (slug) DO UPDATE SET
				   name = EXCLUDED.name,
				   summary = EXCLUDED.summary,
				   tags = EXCLUDED.tags,
				   url = EXCLUDED.url,
				   sort_order = EXCLUDED.sort_order,
				   creator_handle = EXCLUDED.creator_handle,
				   is_published = true,
				   synced_at = EXCLUDED.synced_at,
				   source = 'agensi_api'`,
				item.Slug,
				item.Name,
				item.Summary,
				tags,
				item.URL,
				item.SortOrder,
				in.CreatorHandle,
				fetchedAt,
			); err != nil {
				return CommitAgensiSyncResult{}, err
			}
		}
		syncedCount = len(in.Items)
	}

	activeSkills, err := queryCreatorPublishedAgensiSkillsWith(ctx, tx, in.CreatorHandle)
	if err != nil {
		return CommitAgensiSyncResult{}, err
	}
	nextStatus := "empty"
	if len(activeSkills) > 0 {
		nextStatus = "ok"
	}
	var etagPtr *string
	if trimmed := strings.TrimSpace(in.ETag); trimmed != "" {
		etagPtr = &trimmed
	}
	now := time.Now().UTC()

	var updated AgensiSyncStateRecord
	if err := tx.QueryRow(
		ctx,
		`UPDATE agensi_sync_state
		 SET last_synced_at = $2,
		     last_attempt_at = $3,
		     last_status = $4,
		     last_error = NULL,
		     item_count = $5,
		     etag = $6
		 WHERE creator_handle = $1
		 RETURNING creator_handle, last_synced_at, last_attempt_at, last_status, last_error, item_count, etag`,
		in.CreatorHandle,
		fetchedAt,
		now,
		nextStatus,
		len(activeSkills),
		etagPtr,
	).Scan(
		&updated.CreatorHandle,
		&updated.LastSyncedAt,
		&updated.LastAttemptAt,
		&updated.LastStatus,
		&updated.LastError,
		&updated.ItemCount,
		&updated.ETag,
	); err != nil {
		return CommitAgensiSyncResult{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return CommitAgensiSyncResult{}, err
	}

	durationMs := int64(0)
	if !in.StartedAt.IsZero() {
		durationMs = time.Since(in.StartedAt).Milliseconds()
	}
	emitPortalPGSeam("RULE_DIVERGENCE", "agensi.sync.completed", map[string]any{
		"correlationId":    in.CorrelationID,
		"creatorHandle":    in.CreatorHandle,
		"branch":           "live_sync",
		"fallbackUsed":     false,
		"notModified":      in.NotModified,
		"syncedCount":      syncedCount,
		"deactivatedCount": deactivatedCount,
		"durationMs":       durationMs,
		"source":           "agensi_api",
	})

	return CommitAgensiSyncResult{
		CreatorHandle:    in.CreatorHandle,
		SyncState:        updated,
		Skills:           activeSkills,
		NotModified:      in.NotModified,
		SyncedCount:      syncedCount,
		DeactivatedCount: deactivatedCount,
	}, nil
}
