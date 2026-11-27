package main

import (
	"context"
	"errors"
	"strings"
	"sync"
	"time"

	"connectrpc.com/connect"
	"github.com/AndrewK4758/aklapper/packages/go/kit/agensi"
	portalv1 "github.com/AndrewK4758/aklapper/packages/go/kit/gen/portal/v1"
	"github.com/AndrewK4758/aklapper/packages/go/kit/gen/portal/v1/portalv1connect"
	"github.com/AndrewK4758/aklapper/packages/go/kit/pg"
)

type agensiSyncFlight struct {
	done chan struct{}
	res  pg.CommitAgensiSyncResult
	err  error
}

type agensiServiceServer struct {
	deps     portalServiceDeps
	mu       sync.Mutex
	inFlight map[string]*agensiSyncFlight
}

var _ portalv1connect.AgensiServiceHandler = (*agensiServiceServer)(nil)

func newAgensiServiceServer(deps portalServiceDeps) *agensiServiceServer {
	return &agensiServiceServer{
		deps:     deps,
		inFlight: make(map[string]*agensiSyncFlight),
	}
}

func emitAgensiLoadBranch(branch string, fields map[string]any) {
	payload := make(map[string]any, len(fields)+2)
	for k, v := range fields {
		payload[k] = v
	}
	payload["metric"] = "seam_decision_branch_total"
	payload["branch_taken"] = branch
	logPortalSeam("RULE_DIVERGENCE", "agensi.catalog.load_branch", payload)
}

func buildFallbackBadge(hasCached bool) *portalv1.StatusBadgeSpec {
	label := "catalog · unavailable"
	if hasCached {
		label = "catalog · cached fallback"
	}
	return &portalv1.StatusBadgeSpec{
		Source: "agensi-catalog",
		State:  "idle",
		Label:  label,
	}
}

func toProtoAgensiSkills(skills []agensi.Skill) []*portalv1.AgensiSkill {
	out := make([]*portalv1.AgensiSkill, 0, len(skills))
	for _, sk := range skills {
		out = append(out, toProtoAgensiSkill(sk))
	}
	return out
}

func (s *agensiServiceServer) runSingleflightSync(
	ctx context.Context,
	cfg agensi.Config,
	forceRefresh bool,
	corrID string,
) (pg.CommitAgensiSyncResult, error) {
	modeTag := "std"
	if forceRefresh {
		modeTag = "force"
	}
	key := strings.ToLower(cfg.CreatorHandle) + "::" + modeTag

	s.mu.Lock()
	if existing, ok := s.inFlight[key]; ok {
		s.mu.Unlock()
		select {
		case <-existing.done:
			return existing.res, existing.err
		case <-ctx.Done():
			return pg.CommitAgensiSyncResult{}, ctx.Err()
		}
	}
	flight := &agensiSyncFlight{done: make(chan struct{})}
	s.inFlight[key] = flight
	s.mu.Unlock()

	go func() {
		defer func() {
			s.mu.Lock()
			delete(s.inFlight, key)
			s.mu.Unlock()
			close(flight.done)
		}()

		syncCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 15*time.Second)
		defer cancel()

		flight.res, flight.err = s.executeCreatorSync(syncCtx, cfg, forceRefresh, corrID)
	}()

	select {
	case <-flight.done:
		return flight.res, flight.err
	case <-ctx.Done():
		return pg.CommitAgensiSyncResult{}, ctx.Err()
	}
}

func (s *agensiServiceServer) executeCreatorSync(
	ctx context.Context,
	cfg agensi.Config,
	forceRefresh bool,
	corrID string,
) (pg.CommitAgensiSyncResult, error) {
	startedAt := s.deps.now()
	preState, err := s.deps.store.ReadAgensiSyncState(ctx, cfg.CreatorHandle)
	if err != nil {
		return pg.CommitAgensiSyncResult{}, err
	}
	existingActive, err := s.deps.store.QueryCreatorPublishedAgensiSkills(ctx, cfg.CreatorHandle)
	if err != nil {
		return pg.CommitAgensiSyncResult{}, err
	}

	var preFetchLastSynced *time.Time
	etag := ""
	if preState != nil {
		preFetchLastSynced = preState.LastSyncedAt
		if !forceRefresh && len(existingActive) > 0 && preState.ETag != nil {
			etag = *preState.ETag
		}
	}

	fetchRes := agensi.FetchCreatorCatalog(ctx, cfg, agensi.FetchOptions{
		CorrelationID: corrID,
		ETag:          etag,
		HTTPClient:    s.deps.agensiHTTPClient,
	})
	if !fetchRes.OK {
		safeMsg := agensi.ScrubSecret(fetchRes.Message, cfg.APIKey)
		if _, recErr := s.deps.store.RecordAgensiFailureTx(ctx, cfg.CreatorHandle, safeMsg, startedAt); recErr != nil {
			logPortalSeam("BOUNDARY_FAULT", "agensi.sync.failure_state_write_failed", map[string]any{
				"correlationId": corrID,
				"creatorHandle": cfg.CreatorHandle,
			})
		}
		return pg.CommitAgensiSyncResult{}, errors.New(safeMsg)
	}

	committed, commitErr := s.deps.store.CommitAgensiSyncTx(ctx, pg.CommitAgensiSyncInput{
		CreatorHandle:      cfg.CreatorHandle,
		TTLSeconds:         cfg.TTLSeconds,
		ForceRefresh:       forceRefresh,
		NotModified:        fetchRes.NotModified,
		Items:              fetchRes.Items,
		ETag:               fetchRes.ETag,
		FetchedAt:          fetchRes.FetchedAt,
		PreFetchLastSynced: preFetchLastSynced,
		CorrelationID:      corrID,
		StartedAt:          startedAt,
	})
	if commitErr != nil {
		logPortalSeam("DELTA_AUDIT_GAP", "agensi.sync.reconcile_outcome_unlogged", map[string]any{
			"correlationId": corrID,
			"creatorHandle": cfg.CreatorHandle,
		})
		return pg.CommitAgensiSyncResult{}, commitErr
	}
	return committed, nil
}

func (s *agensiServiceServer) GetCatalog(
	ctx context.Context,
	req *connect.Request[portalv1.GetCatalogRequest],
) (*connect.Response[portalv1.GetCatalogResponse], error) {
	corrID := resolveCorrID(ctx)
	contentJSON, err := s.deps.store.LoadSiteContentJSON(ctx, "portal-agensi")
	if err != nil {
		return nil, mapStoreErrorToConnect(err, corrID)
	}

	cfg := agensi.ResolveConfigFromEnv()
	preState, err := s.deps.store.ReadAgensiSyncState(ctx, cfg.CreatorHandle)
	if err != nil {
		return nil, mapStoreErrorToConnect(err, corrID)
	}
	cachedSkills, err := s.deps.store.QueryCreatorPublishedAgensiSkills(ctx, cfg.CreatorHandle)
	if err != nil {
		return nil, mapStoreErrorToConnect(err, corrID)
	}

	forceRefresh := req.Msg.GetForceRefresh()
	now := s.deps.now()
	isFresh := !forceRefresh &&
		preState != nil &&
		preState.LastSyncedAt != nil &&
		cfg.TTLSeconds > 0 &&
		now.Sub(*preState.LastSyncedAt) < time.Duration(cfg.TTLSeconds)*time.Second &&
		(preState.LastStatus == "ok" || preState.LastStatus == "empty")

	if isFresh {
		emitAgensiLoadBranch("cache_hit", map[string]any{
			"correlationId": corrID,
			"creatorHandle": cfg.CreatorHandle,
			"fallbackUsed":  false,
			"cachedCount":   len(cachedSkills),
		})
		return connect.NewResponse(&portalv1.GetCatalogResponse{
			ContentJson: contentJSON,
			Skills:      toProtoAgensiSkills(cachedSkills),
			CatalogMeta: &portalv1.AgensiCatalogMeta{
				Mode:          "cache",
				CreatorHandle: cfg.CreatorHandle,
				SyncedAt:      formatOptISO(preState.LastSyncedAt),
			},
			SyncState: toProtoAgensiSyncState(preState),
		}), nil
	}

	if cfg.BaseURL == "" {
		hasCached := len(cachedSkills) > 0
		mode := "empty"
		branch := "cold_empty"
		if hasCached {
			mode = "cached_fallback"
			branch = "stale_fallback"
		}
		emitAgensiLoadBranch(branch, map[string]any{
			"correlationId": corrID,
			"creatorHandle": cfg.CreatorHandle,
			"fallbackUsed":  true,
			"cachedCount":   len(cachedSkills),
		})
		var lastSynced *time.Time
		if preState != nil {
			lastSynced = preState.LastSyncedAt
		}
		return connect.NewResponse(&portalv1.GetCatalogResponse{
			ContentJson: contentJSON,
			Skills:      toProtoAgensiSkills(cachedSkills),
			CatalogMeta: &portalv1.AgensiCatalogMeta{
				Mode:          mode,
				CreatorHandle: cfg.CreatorHandle,
				SyncedAt:      formatOptISO(lastSynced),
			},
			StatusBadgeOverride: buildFallbackBadge(hasCached),
			SyncState:           toProtoAgensiSyncState(preState),
		}), nil
	}

	synced, syncErr := s.runSingleflightSync(ctx, cfg, forceRefresh, corrID)
	if syncErr == nil {
		mode := "empty"
		branch := "cold_empty"
		if len(synced.Skills) > 0 {
			mode = "live"
			branch = "live_sync"
		}
		emitAgensiLoadBranch(branch, map[string]any{
			"correlationId": corrID,
			"creatorHandle": cfg.CreatorHandle,
			"fallbackUsed":  false,
			"syncedCount":   len(synced.Skills),
		})
		stateCopy := synced.SyncState
		return connect.NewResponse(&portalv1.GetCatalogResponse{
			ContentJson: contentJSON,
			Skills:      toProtoAgensiSkills(synced.Skills),
			CatalogMeta: &portalv1.AgensiCatalogMeta{
				Mode:          mode,
				CreatorHandle: cfg.CreatorHandle,
				SyncedAt:      formatOptISO(stateCopy.LastSyncedAt),
			},
			SyncState: toProtoAgensiSyncState(&stateCopy),
		}), nil
	}

	latestState, _ := s.deps.store.ReadAgensiSyncState(ctx, cfg.CreatorHandle)
	fallbackSkills, _ := s.deps.store.QueryCreatorPublishedAgensiSkills(ctx, cfg.CreatorHandle)
	hasCached := len(fallbackSkills) > 0
	mode := "empty"
	branch := "cold_empty"
	if hasCached {
		mode = "cached_fallback"
		branch = "stale_fallback"
	}
	emitAgensiLoadBranch(branch, map[string]any{
		"correlationId": corrID,
		"creatorHandle": cfg.CreatorHandle,
		"fallbackUsed":  true,
		"cachedCount":   len(fallbackSkills),
		"errorMessage":  agensi.ScrubSecret(syncErr.Error(), cfg.APIKey),
	})
	var lastSynced *time.Time
	if latestState != nil {
		lastSynced = latestState.LastSyncedAt
	}
	return connect.NewResponse(&portalv1.GetCatalogResponse{
		ContentJson: contentJSON,
		Skills:      toProtoAgensiSkills(fallbackSkills),
		CatalogMeta: &portalv1.AgensiCatalogMeta{
			Mode:          mode,
			CreatorHandle: cfg.CreatorHandle,
			SyncedAt:      formatOptISO(lastSynced),
		},
		StatusBadgeOverride: buildFallbackBadge(hasCached),
		SyncState:           toProtoAgensiSyncState(latestState),
	}), nil
}
