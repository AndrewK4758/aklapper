package pg

import (
	"context"
	"errors"
	"fmt"
	"os"
	"sync"
	"testing"
	"time"

	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
)

func TestPostgresLiveQuotaTurnsAndLoadCorpusDocs(t *testing.T) {
	if os.Getenv("DATABASE_URL") == "" {
		t.Skip("DATABASE_URL not set; skipping live PG19 integration test")
	}

	ctx := context.Background()
	store, err := OpenFromEnvStrict(ctx)
	if err != nil {
		t.Fatalf("OpenFromEnvStrict failed: %v", err)
	}
	t.Cleanup(store.Close)

	// Seed rows across site_content, agensi_skills, and roadmap_milestones cleanly for live corpus queries
	if _, err := store.pool.Exec(ctx, `
		INSERT INTO site_content (key, markdown_body, metadata_json)
		VALUES ('test-site-corpus', 'Streaming SSR and Go microservices corpus text.', '{}'::jsonb)
		ON CONFLICT (key) DO UPDATE SET markdown_body = EXCLUDED.markdown_body;
		INSERT INTO agensi_skills (slug, name, summary, tags, url, sort_order, creator_handle, is_published, source)
		VALUES
			('test-skill-rag', 'RAG Search Skill', 'Indexed vector skill.', ARRAY['rag','go'], 'https://agensi.io/skills/test-rag', 999, 'aklapper', true, 'agensi_api'),
			('test-skill-foreign', 'Foreign Creator Skill', 'Should be excluded from corpus.', ARRAY['foreign'], 'https://agensi.io/skills/test-foreign', 1000, 'other-creator', true, 'agensi_api'),
			('test-skill-unpublished', 'Unpublished Skill', 'Should be excluded from corpus.', ARRAY['draft'], 'https://agensi.io/skills/test-unpublished', 1001, 'aklapper', false, 'agensi_api')
		ON CONFLICT (slug) DO UPDATE SET
			summary = EXCLUDED.summary,
			creator_handle = EXCLUDED.creator_handle,
			is_published = EXCLUDED.is_published,
			source = EXCLUDED.source;
		INSERT INTO roadmap_milestones (slug, status, label, sort_order, enabled)
		VALUES ('test-milestone-pg', 'done', 'PG19 Vector Pipeline', 999, true)
		ON CONFLICT (slug) DO UPDATE SET label = EXCLUDED.label;
	`); err != nil {
		t.Fatalf("seed corpus rows failed: %v", err)
	}
	t.Cleanup(func() {
		_, _ = store.pool.Exec(context.Background(), `
			DELETE FROM site_content WHERE key = 'test-site-corpus';
			DELETE FROM agensi_skills WHERE slug IN ('test-skill-rag', 'test-skill-foreign', 'test-skill-unpublished');
			DELETE FROM roadmap_milestones WHERE slug = 'test-milestone-pg';
		`)
	})

	docs, err := store.LoadCorpusDocs(ctx)
	if err != nil {
		t.Fatalf("LoadCorpusDocs failed: %v", err)
	}
	if len(docs) < 7 {
		t.Fatalf("expected curated + seeded site/skill/milestone docs (>=7), got %d", len(docs))
	}
	seenIDs := make(map[string]bool, len(docs))
	for _, doc := range docs {
		seenIDs[doc.ID] = true
	}
	if !seenIDs["agensi:test-skill-rag"] {
		t.Fatalf("expected published creator skill agensi:test-skill-rag in corpus, got IDs=%v", seenIDs)
	}
	if seenIDs["agensi:test-skill-foreign"] || seenIDs["agensi:test-skill-unpublished"] {
		t.Fatalf("expected foreign and unpublished skills excluded from corpus, got IDs=%v", seenIDs)
	}

	// Verify LoadCorpusDocs fails loudly on SQL errors (canceled context / aborted connection)
	canceledCtx, cancel := context.WithCancel(ctx)
	cancel()
	if _, err := store.LoadCorpusDocs(canceledCtx); err == nil {
		t.Fatal("expected LoadCorpusDocs to propagate SQL/context error cleanly instead of returning partial docs")
	}

	// Verify concurrent FOR UPDATE turn reservations serialize cleanly against real PG19
	sessionID := "pg_live_race_" + newUUIDv4()
	todayKey := "global:" + time.Now().UTC().Format("2006-01-02")
	t.Cleanup(func() {
		_, _ = store.pool.Exec(context.Background(), `DELETE FROM ask_turns WHERE session_id = $1`, sessionID)
		_, _ = store.pool.Exec(context.Background(), `DELETE FROM rate_limit_buckets WHERE scope_key IN ($1, $2)`, "session:"+sessionID, todayKey)
	})

	var wg sync.WaitGroup
	var mu sync.Mutex
	allowedCnt, rejectedCnt := 0, 0
	attemptIDs := make([]string, 12)
	for i := range 12 {
		attemptIDs[i] = newUUIDv4()
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			_, allowed, rErr := store.ReserveTurnTx(ctx, ReserveTurnInput{
				AttemptID: attemptIDs[idx], SessionID: sessionID, Role: contracts.RoleGuest, Mode: "qa",
				PromptHash: "live-hash-" + attemptIDs[idx], CorrelationID: "corr-live-" + attemptIDs[idx],
			})
			mu.Lock()
			defer mu.Unlock()
			if rErr != nil {
				t.Errorf("ReserveTurnTx %d unexpected err: %v", idx, rErr)
				return
			}
			if allowed {
				allowedCnt++
			} else {
				rejectedCnt++
			}
		}(i)
	}
	wg.Wait()
	if allowedCnt != 10 || rejectedCnt != 2 {
		t.Fatalf("expected 10 allowed and 2 rejected under FOR UPDATE serialization, got allowed=%d rejected=%d", allowedCnt, rejectedCnt)
	}

	// Verify concurrent Turn 10/10 duplicate attemptId returns idempotent reuse (allowed) rather than false 429
	dupSession := "pg_live_dup10_" + newUUIDv4()
	t.Cleanup(func() {
		_, _ = store.pool.Exec(context.Background(), `DELETE FROM ask_turns WHERE session_id = $1`, dupSession)
		_, _ = store.pool.Exec(context.Background(), `DELETE FROM rate_limit_buckets WHERE scope_key IN ($1, $2)`, "session:"+dupSession, todayKey)
	})
	for i := range 9 {
		id := newUUIDv4()
		if _, allowed, rErr := store.ReserveTurnTx(ctx, ReserveTurnInput{
			AttemptID: id, SessionID: dupSession, Role: contracts.RoleGuest, Mode: "qa",
			PromptHash: "dup10-pre-" + id, CorrelationID: "corr-dup10-pre-" + id,
		}); rErr != nil || !allowed {
			t.Fatalf("pre-turn %d failed: allowed=%v err=%v", i+1, allowed, rErr)
		}
	}
	dupAttempt10 := newUUIDv4()
	var dupWg sync.WaitGroup
	var dupMu sync.Mutex
	dupAllowed, dupReused := 0, 0
	for i := range 2 {
		dupWg.Add(1)
		go func(idx int) {
			defer dupWg.Done()
			res, allowed, rErr := store.ReserveTurnTx(ctx, ReserveTurnInput{
				AttemptID: dupAttempt10, SessionID: dupSession, Role: contracts.RoleGuest, Mode: "qa",
				PromptHash: "dup10-shared-hash", CorrelationID: fmt.Sprintf("corr-dup10-%d", idx),
			})
			dupMu.Lock()
			defer dupMu.Unlock()
			if rErr != nil {
				t.Errorf("concurrent dup attempt 10/10 err (%d): %v", idx, rErr)
				return
			}
			if !allowed || res.Quota.TurnsUsed != 10 {
				t.Errorf("expected allowed=true and turnsUsed=10 on dup attempt 10/10 (%d), got allowed=%v quota=%+v", idx, allowed, res.Quota)
				return
			}
			dupAllowed++
			if res.Reused {
				dupReused++
			}
		}(i)
	}
	dupWg.Wait()
	if dupAllowed != 2 || dupReused != 1 {
		t.Fatalf("expected 2 allowed (1 fresh + 1 reused) for concurrent Turn 10/10 duplicate attemptId, got allowed=%d reused=%d", dupAllowed, dupReused)
	}
	if _, allowedDistinct, dErr := store.ReserveTurnTx(ctx, ReserveTurnInput{
		AttemptID: newUUIDv4(), SessionID: dupSession, Role: contracts.RoleGuest, Mode: "qa",
		PromptHash: "dup10-turn11", CorrelationID: "corr-dup10-turn11",
	}); dErr != nil || allowedDistinct {
		t.Fatalf("expected distinct 11th turn rejected cleanly, got allowed=%v err=%v", allowedDistinct, dErr)
	}

	// Verify expired lease transition in live PG19 + ReconcileTurnTx rejection
	leaseID := newUUIDv4()
	_, _, err = store.ReserveTurnTx(ctx, ReserveTurnInput{
		AttemptID: leaseID, SessionID: "pg_lease_" + leaseID, Role: contracts.RoleGuest, Mode: "qa",
		PromptHash: "lease-hash", CorrelationID: "corr-lease-pg",
	})
	if err != nil {
		t.Fatalf("ReserveTurnTx lease failed: %v", err)
	}
	t.Cleanup(func() {
		_, _ = store.pool.Exec(context.Background(), `DELETE FROM ask_turns WHERE attempt_id = $1`, leaseID)
		_, _ = store.pool.Exec(context.Background(), `DELETE FROM rate_limit_buckets WHERE scope_key = $1`, "session:pg_lease_"+leaseID)
	})
	if _, err := store.pool.Exec(ctx, `UPDATE ask_turns SET lease_expires_at = NOW() - interval '90 seconds' WHERE attempt_id = $1`, leaseID); err != nil {
		t.Fatalf("backdate lease failed: %v", err)
	}
	if _, err := store.ReconcileTurnTx(ctx, leaseID, contracts.AskResponse{
		Grounded: true, Mode: "qa", Answer: "stale", Provider: "local", TokensUsed: 800,
	}); !errors.Is(err, ErrTurnLeaseExpired) {
		t.Fatalf("expected ErrTurnLeaseExpired on live PG19, got %v", err)
	}
	rec, quota, err := store.GetTurnByAttemptID(ctx, leaseID, "pg_lease_"+leaseID)
	if err != nil || rec.Status != contracts.TurnStatusExpired || quota.TurnsUsed != 0 || quota.TokensUsed != 0 {
		t.Fatalf("expected expired status + refunded quota, got rec=%+v quota=%+v err=%v", rec, quota, err)
	}

	// Verify ExtendTurnLeaseTx on live PG19 extends active lease and caps at 5m
	extID := newUUIDv4()
	extRes, extOK, err := store.ReserveTurnTx(ctx, ReserveTurnInput{
		AttemptID: extID, SessionID: "pg_ext_" + extID, Role: contracts.RoleGuest, Mode: "qa",
		PromptHash: "ext-hash", CorrelationID: "corr-ext-pg",
	})
	if err != nil || !extOK {
		t.Fatalf("ReserveTurnTx ext failed: %v", err)
	}
	t.Cleanup(func() {
		_, _ = store.pool.Exec(context.Background(), `DELETE FROM ask_turns WHERE attempt_id = $1`, extID)
		_, _ = store.pool.Exec(context.Background(), `DELETE FROM rate_limit_buckets WHERE scope_key = $1`, "session:pg_ext_"+extID)
	})
	newLease, err := store.ExtendTurnLeaseTx(ctx, extID, 90*time.Second)
	if err != nil || !newLease.After(extRes.Turn.LeaseExpiresAt) {
		t.Fatalf("expected extended PG lease after %v, got %v err=%v", extRes.Turn.LeaseExpiresAt, newLease, err)
	}

	// Verify AI_DEV_UNLIMITED=true in local dev bypasses 10-turn guest cap while still writing ask_turns audit rows
	t.Setenv("APP_ENV", "development")
	t.Setenv("NODE_ENV", "development")
	t.Setenv("AI_PROVIDER", "local")
	t.Setenv("AI_DEV_UNLIMITED", "true")
	devAttempt := newUUIDv4()
	devRes, devAllowed, err := store.ReserveTurnTx(ctx, ReserveTurnInput{
		AttemptID: devAttempt, SessionID: dupSession, Role: contracts.RoleGuest, Mode: "qa",
		PromptHash: "dev-unlimited-turn11", CorrelationID: "corr-dev-unlimited",
	})
	if err != nil || !devAllowed || devRes.Quota.TurnsUsed != 11 {
		t.Fatalf("expected local AI_DEV_UNLIMITED=true to allow 11th turn and increment usage, got allowed=%v quota=%+v err=%v", devAllowed, devRes.Quota, err)
	}
	t.Cleanup(func() {
		_, _ = store.pool.Exec(context.Background(), `DELETE FROM ask_turns WHERE attempt_id = $1`, devAttempt)
	})
	if _, err := store.ReconcileTurnTx(ctx, devAttempt, contracts.AskResponse{
		Grounded: true, Mode: "qa", Answer: "dev unlimited persisted", Provider: "local", TokensUsed: 50,
	}); err != nil {
		t.Fatalf("expected ask_turns audit row reconciled under AI_DEV_UNLIMITED, got %v", err)
	}

	// Verify career_dossiers multi-chunk loading, draft isolation, dual-dictionary lexical search,
	// session-pinned advisory lock, concurrent monotonic turn_index, and out-of-tx terminal purge.
	pubSlug := "pg-live-pub-" + newUUIDv4()[:8]
	draftSlug := "pg-live-draft-" + newUUIDv4()[:8]
	if _, err := store.pool.Exec(ctx, `
		INSERT INTO career_dossiers
		(slug, kind, title, domain_label, role_title, timeframe, skills, summary_body, sections_json, publish_status, sanitization_verified_at, sort_order)
		VALUES
		($1, 'architecture', 'Live K8s gRPC Platform', 'Cloud', 'Principal Architect', '2025', ARRAY['K8s','gRPC','PG19'], 'High-scale multi-region services.', '[{"heading":"Service Mesh","body":"Zero-trust mTLS routing across GKE Autopilot."}]'::jsonb, 'published', NOW(), 50),
		($2, 'experience', 'Unpublished Draft Dossier', 'Cloud', 'Lead', '2025', ARRAY['UniqueDraftTokenXYZ'], 'Draft only body.', '[]'::jsonb, 'draft', NOW(), 51)
	`, pubSlug, draftSlug); err != nil {
		t.Fatalf("seed career_dossiers failed: %v", err)
	}
	t.Cleanup(func() {
		_, _ = store.pool.Exec(context.Background(), `DELETE FROM career_dossiers WHERE slug IN ($1, $2)`, pubSlug, draftSlug)
	})

	corpusWithDossiers, err := store.LoadCorpusDocs(ctx)
	if err != nil {
		t.Fatalf("LoadCorpusDocs with dossiers failed: %v", err)
	}
	foundChunk0, foundChunk1 := false, false
	for _, doc := range corpusWithDossiers {
		if doc.ID == "dossier:"+draftSlug {
			t.Fatalf("draft dossier leaked into LoadCorpusDocs: %+v", doc)
		}
		if doc.ID == "dossier:"+pubSlug && doc.ChunkIndex == 0 {
			foundChunk0 = true
		}
		if doc.ID == "dossier:"+pubSlug && doc.ChunkIndex == 1 && doc.SectionHeading == "Service Mesh" {
			foundChunk1 = true
		}
	}
	if !foundChunk0 || !foundChunk1 {
		t.Fatalf("expected published dossier chunks 0 and 1, got chunk0=%v chunk1=%v", foundChunk0, foundChunk1)
	}

	lexHits, err := store.SearchPublishedDossiersLexical(ctx, "gRPC PG19", 8)
	if err != nil || len(lexHits) == 0 || lexHits[0].DocKey != "dossier:"+pubSlug {
		t.Fatalf("expected lexical hit for published dossier acronym query, got hits=%+v err=%v", lexHits, err)
	}
	draftHits, err := store.SearchPublishedDossiersLexical(ctx, "UniqueDraftTokenXYZ", 8)
	if err != nil || len(draftHits) != 0 {
		t.Fatalf("expected 0 lexical hits for draft dossier, got hits=%+v err=%v", draftHits, err)
	}

	// Session-pinned advisory lock serializes concurrent reindex callers
	rel1, acq1, err := store.TryAcquireReindexLock(ctx)
	if err != nil || !acq1 {
		t.Fatalf("expected first reindex lock acquired, got acq=%v err=%v", acq1, err)
	}
	_, acq2, err := store.TryAcquireReindexLock(ctx)
	if err != nil || acq2 {
		t.Fatalf("expected second concurrent reindex lock contended, got acq=%v err=%v", acq2, err)
	}
	if err := rel1(ctx); err != nil {
		t.Fatalf("release reindex lock failed: %v", err)
	}
	rel3, acq3, err := store.TryAcquireReindexLock(ctx)
	if err != nil || !acq3 {
		t.Fatalf("expected reindex lock re-acquired after release, got acq=%v err=%v", acq3, err)
	}
	_ = rel3(ctx)

	// Concurrent multi-tab submits produce strictly monotonic turn_index + terminal-only purge skips pending rows
	convSession := "pg_conv_" + newUUIDv4()
	convID := newUUIDv4()
	termExpiredID := newUUIDv4()
	pendingExpiredID := newUUIDv4()
	t.Cleanup(func() {
		_, _ = store.pool.Exec(context.Background(), `DELETE FROM ask_turns WHERE session_id = $1 OR attempt_id IN ($2, $3)`, convSession, termExpiredID, pendingExpiredID)
		_, _ = store.pool.Exec(context.Background(), `DELETE FROM rate_limit_buckets WHERE scope_key IN ($1, $2)`, "session:"+convSession, todayKey)
	})
	if _, err := store.pool.Exec(ctx, `
		INSERT INTO ask_turns (attempt_id, session_id, role, mode, prompt_hash, status, tokens_reserved, tokens_used, correlation_id, lease_expires_at, expires_at)
		VALUES
		($1, 'purge_sess', 'guest', 'qa', 'h1', 'completed', 100, 100, 'c1', NOW() - interval '20 minutes', NOW() - interval '5 minutes'),
		($2, 'purge_sess', 'guest', 'qa', 'h2', 'pending', 100, 0, 'c2', NOW() - interval '20 minutes', NOW() - interval '5 minutes')
	`, termExpiredID, pendingExpiredID); err != nil {
		t.Fatalf("seed purge rows failed: %v", err)
	}

	var convWg sync.WaitGroup
	indices := make([]int, 2)
	for i := range 2 {
		convWg.Add(1)
		go func(idx int) {
			defer convWg.Done()
			att := newUUIDv4()
			res, allowed, rErr := store.ReserveTurnTx(ctx, ReserveTurnInput{
				AttemptID: att, SessionID: convSession, Role: contracts.RoleGuest, Mode: "qa",
				ConversationID: convID, PromptText: fmt.Sprintf("Turn prompt %d", idx),
				PromptHash: fmt.Sprintf("conv-hash-%d-%s", idx, att), CorrelationID: "corr-conv-" + att,
			})
			if rErr != nil || !allowed {
				t.Errorf("conv turn %d failed: allowed=%v err=%v", idx, allowed, rErr)
				return
			}
			indices[idx] = res.Turn.TurnIndex
			_, _ = store.ReconcileTurnTx(ctx, att, contracts.AskResponse{
				Grounded: true, Mode: "qa", Answer: fmt.Sprintf("Answer %d", idx), Provider: "local", TokensUsed: 50,
			})
		}(i)
	}
	convWg.Wait()
	if !((indices[0] == 1 && indices[1] == 2) || (indices[0] == 2 && indices[1] == 1)) {
		t.Fatalf("expected strictly monotonic turn_index {1,2}, got %v", indices)
	}
	history, err := store.ListConversationHistory(ctx, convSession, convID, 6)
	if err != nil || len(history) != 2 || history[0].TurnIndex != 1 || history[1].TurnIndex != 2 {
		t.Fatalf("expected chronological 2-turn history, got %+v err=%v", history, err)
	}
	crossHistory, err := store.ListConversationHistory(ctx, "other-session", convID, 6)
	if err != nil || len(crossHistory) != 0 {
		t.Fatalf("expected 0 cross-session history rows, got %+v err=%v", crossHistory, err)
	}

	// Verify terminal expired row purged while pending expired row stayed untouched
	var termExists, pendExists int
	_ = store.pool.QueryRow(ctx, `SELECT COUNT(*) FROM ask_turns WHERE attempt_id = $1`, termExpiredID).Scan(&termExists)
	_ = store.pool.QueryRow(ctx, `SELECT COUNT(*) FROM ask_turns WHERE attempt_id = $1`, pendingExpiredID).Scan(&pendExists)
	if termExists != 0 || pendExists != 1 {
		t.Fatalf("expected terminal expired row purged (0) and pending row preserved (1), got term=%d pend=%d", termExists, pendExists)
	}

	// Verify partial abort reconciliation + 499 / 403 error mapping
	abortID := newUUIDv4()
	if _, allowed, err := store.ReserveTurnTx(ctx, ReserveTurnInput{
		AttemptID: abortID, SessionID: convSession, Role: contracts.RoleGuest, Mode: "qa",
		ConversationID: convID, PromptText: "Aborted turn", PromptHash: "abort-hash-" + abortID, CorrelationID: "corr-abort-499",
	}); err != nil || !allowed {
		t.Fatalf("reserve abort turn failed: allowed=%v err=%v", allowed, err)
	}
	if _, err := store.ReconcilePartialAbortTurnTx(ctx, abortID, 77, contracts.ErrCodeStreamAborted); err != nil {
		t.Fatalf("ReconcilePartialAbortTurnTx failed: %v", err)
	}
	abortedRec, abortedQuota, err := store.GetTurnByAttemptID(ctx, abortID, convSession)
	if err != nil || abortedRec.Status != contracts.TurnStatusFailed || abortedRec.TokensUsed != 77 {
		t.Fatalf("unexpected partial-aborted turn: rec=%+v err=%v", abortedRec, err)
	}
	abortedState := abortedRec.ToState(&abortedQuota)
	if abortedState.Error == nil || abortedState.Error.Status != 499 || abortedState.Error.Code != contracts.ErrCodeStreamAborted {
		t.Fatalf("expected 499 ERR_STREAM_ABORTED state error, got %+v", abortedState.Error)
	}
	forbState := (TurnRecord{Status: contracts.TurnStatusFailed, ErrorCode: contracts.ErrCodeForbidden, CorrelationID: "c-403"}).ToState(nil)
	if forbState.Error == nil || forbState.Error.Status != 403 || forbState.Error.Code != contracts.ErrCodeForbidden {
		t.Fatalf("expected 403 ERR_FORBIDDEN state error, got %+v", forbState.Error)
	}
}
