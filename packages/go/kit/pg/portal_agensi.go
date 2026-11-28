package pg

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"time"

	"github.com/AndrewK4758/aklapper/packages/go/kit/agensi"
	"github.com/jackc/pgx/v5"
)

type AgensiSyncStateRecord struct {
	CreatorHandle string
	LastSyncedAt  *time.Time
	LastAttemptAt *time.Time
	LastStatus    string
	LastError     *string
	ItemCount     int
	ETag          *string
}

type agensiQueryer interface {
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

func emitPortalPGSeam(seamType, event string, fields map[string]any) {
	payload := make(map[string]any, len(fields)+2)
	for k, v := range fields {
		payload[k] = v
	}
	payload["seam_type"] = seamType
	payload["event"] = event
	if raw, err := json.Marshal(payload); err == nil {
		log.Println(string(raw))
	}
}

func readAgensiSyncStateWith(ctx context.Context, q agensiQueryer, creatorHandle string) (*AgensiSyncStateRecord, error) {
	var rec AgensiSyncStateRecord
	err := q.QueryRow(
		ctx,
		`SELECT creator_handle, last_synced_at, last_attempt_at, last_status, last_error, item_count, etag
		 FROM agensi_sync_state
		 WHERE creator_handle = $1
		 LIMIT 1`,
		creatorHandle,
	).Scan(
		&rec.CreatorHandle,
		&rec.LastSyncedAt,
		&rec.LastAttemptAt,
		&rec.LastStatus,
		&rec.LastError,
		&rec.ItemCount,
		&rec.ETag,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &rec, nil
}

func queryCreatorPublishedAgensiSkillsWith(ctx context.Context, q agensiQueryer, creatorHandle string) ([]agensi.Skill, error) {
	rows, err := q.Query(
		ctx,
		`SELECT slug, name, summary, tags, url, sort_order, creator_handle, is_published, synced_at, source
		 FROM agensi_skills
		 WHERE lower(creator_handle) = lower($1) AND is_published = true
		 ORDER BY sort_order ASC, slug ASC`,
		creatorHandle,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	skills := make([]agensi.Skill, 0)
	for rows.Next() {
		var sk agensi.Skill
		var syncedAt *time.Time
		if scanErr := rows.Scan(
			&sk.Slug,
			&sk.Name,
			&sk.Summary,
			&sk.Tags,
			&sk.URL,
			&sk.SortOrder,
			&sk.CreatorHandle,
			&sk.IsPublished,
			&syncedAt,
			&sk.Source,
		); scanErr != nil {
			return nil, scanErr
		}
		if sk.Tags == nil {
			sk.Tags = []string{}
		}
		if syncedAt != nil {
			iso := syncedAt.UTC().Format(time.RFC3339Nano)
			sk.SyncedAt = &iso
		}
		skills = append(skills, sk)
	}
	return skills, rows.Err()
}

func (s *Store) ReadAgensiSyncState(ctx context.Context, creatorHandle string) (*AgensiSyncStateRecord, error) {
	if s == nil || s.pool == nil {
		return nil, nil
	}
	return readAgensiSyncStateWith(ctx, s.pool, creatorHandle)
}

func (s *Store) QueryCreatorPublishedAgensiSkills(ctx context.Context, creatorHandle string) ([]agensi.Skill, error) {
	if s == nil || s.pool == nil {
		return []agensi.Skill{}, nil
	}
	return queryCreatorPublishedAgensiSkillsWith(ctx, s.pool, creatorHandle)
}

func equalOptionalTimes(a, b *time.Time) bool {
	if a == nil && b == nil {
		return true
	}
	if a == nil || b == nil {
		return false
	}
	return a.UTC().Truncate(time.Millisecond).Equal(b.UTC().Truncate(time.Millisecond))
}

func defaultSyncState(creatorHandle string) AgensiSyncStateRecord {
	return AgensiSyncStateRecord{
		CreatorHandle: creatorHandle,
		LastStatus:    "idle",
		ItemCount:     0,
	}
}

// RecordAgensiFailureTx records an upstream Agensi fetch error under FOR UPDATE without
// clobbering a fresher successful sync or attempt committed concurrently.
func (s *Store) RecordAgensiFailureTx(ctx context.Context, creatorHandle, errorMessage string, attemptStartedAt time.Time) (*AgensiSyncStateRecord, error) {
	if s == nil || s.pool == nil {
		return nil, nil
	}
	if attemptStartedAt.IsZero() {
		attemptStartedAt = time.Now().UTC()
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if _, err := tx.Exec(
		ctx,
		`INSERT INTO agensi_sync_state (creator_handle, last_status, item_count)
		 VALUES ($1, 'idle', 0)
		 ON CONFLICT (creator_handle) DO NOTHING`,
		creatorHandle,
	); err != nil {
		return nil, err
	}

	var postSynced, postAttempt *time.Time
	if err := tx.QueryRow(
		ctx,
		`SELECT last_synced_at, last_attempt_at
		 FROM agensi_sync_state
		 WHERE creator_handle = $1
		 FOR UPDATE`,
		creatorHandle,
	).Scan(&postSynced, &postAttempt); err != nil {
		return nil, err
	}

	if (postSynced != nil && !postSynced.Before(attemptStartedAt)) ||
		(postAttempt != nil && !postAttempt.Before(attemptStartedAt)) {
		existing, err := readAgensiSyncStateWith(ctx, tx, creatorHandle)
		if err != nil {
			return nil, err
		}
		_ = tx.Commit(ctx)
		return existing, nil
	}

	var updated AgensiSyncStateRecord
	if err := tx.QueryRow(
		ctx,
		`UPDATE agensi_sync_state
		 SET last_attempt_at = $2,
		     last_status = 'error',
		     last_error = $3
		 WHERE creator_handle = $1
		 RETURNING creator_handle, last_synced_at, last_attempt_at, last_status, last_error, item_count, etag`,
		creatorHandle,
		attemptStartedAt.UTC(),
		errorMessage,
	).Scan(
		&updated.CreatorHandle,
		&updated.LastSyncedAt,
		&updated.LastAttemptAt,
		&updated.LastStatus,
		&updated.LastError,
		&updated.ItemCount,
		&updated.ETag,
	); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return &updated, nil
}
