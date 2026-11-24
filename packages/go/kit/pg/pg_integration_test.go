package pg

import (
	"context"
	"errors"
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
	defer store.Close()

	// Seed rows across site_content, agensi_skills, and roadmap_milestones cleanly for S-4.1/S-4.2
	if _, err := store.pool.Exec(ctx, `
		INSERT INTO site_content (key, markdown_body, metadata_json)
		VALUES ('test-site-corpus', 'Streaming SSR and Go microservices corpus text.', '{}'::jsonb)
		ON CONFLICT (key) DO UPDATE SET markdown_body = EXCLUDED.markdown_body;
		INSERT INTO agensi_skills (slug, name, summary, tags, url, sort_order)
		VALUES ('test-skill-rag', 'RAG Search Skill', 'Indexed vector skill.', ARRAY['rag','go'], 'https://agensi.io/skills/test-rag', 999)
		ON CONFLICT (slug) DO UPDATE SET summary = EXCLUDED.summary;
		INSERT INTO roadmap_milestones (slug, status, label, sort_order, enabled)
		VALUES ('test-milestone-pg', 'done', 'PG19 Vector Pipeline', 999, true)
		ON CONFLICT (slug) DO UPDATE SET label = EXCLUDED.label;
	`); err != nil {
		t.Fatalf("seed corpus rows failed: %v", err)
	}
	t.Cleanup(func() {
		_, _ = store.pool.Exec(context.Background(), `
			DELETE FROM site_content WHERE key = 'test-site-corpus';
			DELETE FROM agensi_skills WHERE slug = 'test-skill-rag';
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
	attemptIDs := make([]string, 7)
	for i := range 7 {
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
	if allowedCnt != 5 || rejectedCnt != 2 {
		t.Fatalf("expected 5 allowed and 2 rejected under FOR UPDATE serialization, got allowed=%d rejected=%d", allowedCnt, rejectedCnt)
	}

	// Verify expired lease transition in live PG19 + ReconcileTurnTx rejection (CP-13)
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
}
