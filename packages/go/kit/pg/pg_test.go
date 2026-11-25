package pg

import (
	"context"
	"errors"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
	"github.com/jackc/pgx/v5"
)

type stubCorpusQuerier struct {
	queryErr error
	rowsErr  error
	scanErr  error
}

func (q *stubCorpusQuerier) Query(_ context.Context, _ string, _ ...any) (pgx.Rows, error) {
	if q.queryErr != nil {
		return nil, q.queryErr
	}
	return &stubCorpusRows{rowsErr: q.rowsErr, scanErr: q.scanErr}, nil
}

type stubCorpusRows struct {
	pgx.Rows
	idx     int
	rowsErr error
	scanErr error
}

func (r *stubCorpusRows) Close()     {}
func (r *stubCorpusRows) Err() error { return r.rowsErr }
func (r *stubCorpusRows) Next() bool {
	if r.scanErr != nil && r.idx == 0 {
		r.idx++
		return true
	}
	return false
}
func (r *stubCorpusRows) Scan(_ ...any) error {
	if r.scanErr != nil {
		return r.scanErr
	}
	return nil
}

func TestValidateDSN(t *testing.T) {
	t.Parallel()

	if err := ValidateDSN(DefaultDatabaseURL); err != nil {
		t.Fatalf("expected default DSN to be valid, got %v", err)
	}
	if err := ValidateDSN("mysql://localhost/db"); err == nil {
		t.Fatal("expected error for non-postgres scheme")
	}
	if err := ValidateDSN("postgres:///missinghost"); err == nil {
		t.Fatal("expected error for missing host")
	}
	if err := ValidateDSN("postgres://user:pass@/aklapper?host="); err == nil {
		t.Fatal("expected error for empty query host")
	}
	if err := ValidateDSN("postgres://user:pass@/aklapper?host=/cloudsql/games-424800:us-central1:aklapper"); err != nil {
		t.Fatalf("expected Cloud SQL Unix socket DSN with ?host= to be valid, got %v", err)
	}
}

func TestMemoryStoreQuotaFailClosed(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	store := NewMemoryStore()
	store.SetPolicyForTest(QuotaPolicy{
		Role:                 contracts.RoleGuest,
		MaxTurnsPerSession:   2,
		MaxTokensPerRun:      1000,
		MaxDailyGlobalTokens: 1500,
	})

	q1, allowed, err := store.CheckAndConsumeQuota(ctx, contracts.RoleGuest, "sess-1", 1, 600)
	if err != nil || !allowed || q1.TurnsUsed != 1 || q1.TokensUsed != 600 {
		t.Fatalf("expected 1st turn allowed, got allowed=%v q=%+v err=%v", allowed, q1, err)
	}

	q2, allowed, err := store.CheckAndConsumeQuota(ctx, contracts.RoleGuest, "sess-1", 1, 600)
	if err != nil || !allowed || q2.TurnsUsed != 2 || q2.TokensUsed != 1200 {
		t.Fatalf("expected 2nd turn allowed, got allowed=%v q=%+v err=%v", allowed, q2, err)
	}

	// 3rd turn exceeds MaxTurnsPerSession -> fail closed
	q3, allowed, err := store.CheckAndConsumeQuota(ctx, contracts.RoleGuest, "sess-1", 1, 100)
	if err != nil || allowed || q3.TurnsUsed != 2 {
		t.Fatalf("expected 3rd turn rejected, got allowed=%v q=%+v err=%v", allowed, q3, err)
	}

	// Another session exceeding remaining global daily budget -> fail closed
	_, allowedGlobal, err := store.CheckAndConsumeQuota(ctx, contracts.RoleGuest, "sess-2", 1, 500)
	if err != nil || allowedGlobal {
		t.Fatalf("expected global daily budget cap to fail closed, got allowed=%v err=%v", allowedGlobal, err)
	}
}

func TestMemoryStoreSandboxRunsTurnsAndGateVerdict(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	store := NewMemoryStore()

	runID, err := store.CreateSandboxRun(ctx, SandboxRunInput{
		SessionID:    "sess-cadence",
		Prompt:       "Build a telemetry widget",
		ArtifactHTML: "<html><body>ok</body></html>",
		TokensIn:     120,
		TokensOut:    340,
	})
	if err != nil || runID == "" {
		t.Fatalf("CreateSandboxRun failed: id=%q err=%v", runID, err)
	}

	turn, err := store.InsertSandboxTurn(ctx, SandboxTurnInput{
		RunID:     runID,
		Phase:     "triage",
		AgentName: "chord-triage",
		Status:    "completed",
		Summary:   "Validated prompt scope",
		LatencyMs: 14,
	})
	if err != nil || turn.Phase != "triage" {
		t.Fatalf("InsertSandboxTurn failed: turn=%+v err=%v", turn, err)
	}

	runs, err := store.ListSandboxRuns(ctx, "sess-cadence", 5)
	if err != nil || len(runs) != 1 || len(runs[0].Turns) != 1 {
		t.Fatalf("ListSandboxRuns unexpected: runs=%+v err=%v", runs, err)
	}

	totalRuns, pendingGates, err := store.GetSandboxRunSummary(ctx)
	if err != nil || totalRuns != 1 || pendingGates != 1 {
		t.Fatalf("expected 1 total / 1 pending before verdict, got total=%d pending=%d err=%v", totalRuns, pendingGates, err)
	}

	updated, err := store.UpdateSandboxGateVerdict(ctx, runID, "approved")
	if err != nil || updated.GateVerdict != "approved" {
		t.Fatalf("UpdateSandboxGateVerdict failed: updated=%+v err=%v", updated, err)
	}

	if _, err := store.UpdateSandboxGateVerdict(ctx, runID, "bogus"); !errors.Is(err, ErrInvalidVerdict) {
		t.Fatalf("expected ErrInvalidVerdict, got %v", err)
	}
	if _, err := store.UpdateSandboxGateVerdict(ctx, "missing", "rejected"); !errors.Is(err, ErrRunNotFound) {
		t.Fatalf("expected ErrRunNotFound, got %v", err)
	}

	docs, err := store.LoadCorpusDocs(ctx)
	if err != nil || len(docs) < 4 {
		t.Fatalf("expected curated corpus docs, got len=%d err=%v", len(docs), err)
	}
}

func TestOpenFromEnvStrictAndUntouchedOpenFromEnv(t *testing.T) {
	t.Setenv("DATABASE_URL", "")
	if _, err := ConfigFromEnv(); err != nil {
		t.Fatalf("expected untouched ConfigFromEnv to default DSN when DATABASE_URL unset, got %v", err)
	}
	if _, err := OpenFromEnvStrict(context.Background()); err == nil {
		t.Fatal("expected OpenFromEnvStrict to fail closed when DATABASE_URL is empty")
	}

	t.Setenv("DATABASE_URL", "postgres://postgres:postgres@127.0.0.1:59998/aklapper?sslmode=disable")
	if _, err := OpenFromEnvStrict(context.Background()); err == nil {
		t.Fatal("expected OpenFromEnvStrict to fail when PG19 endpoint is unreachable")
	}
}

func TestAskTurnReserveReconcileRefundAndLeaseExpiry(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	store := NewMemoryStore()
	store.SetPolicyForTest(QuotaPolicy{
		Role:                 contracts.RoleGuest,
		MaxTurnsPerSession:   3,
		MaxTokensPerRun:      4000,
		MaxDailyGlobalTokens: 10000,
	})

	// Upward delta reconciliation: reserved 512, actual 1234 -> final tokens 1234 (+722)
	idUp := "11111111-1111-4111-8111-111111111111"
	resUp, allowed, err := store.ReserveTurnTx(ctx, ReserveTurnInput{
		AttemptID: idUp, SessionID: "guest_rec", Role: contracts.RoleGuest, Mode: "qa",
		PromptHash: "hash-up", CorrelationID: "corr-up",
	})
	if err != nil || !allowed || resUp.Quota.TurnsUsed != 1 || resUp.Quota.TokensUsed != 512 {
		t.Fatalf("unexpected reserve up: allowed=%v res=%+v err=%v", allowed, resUp, err)
	}
	// Idempotent duplicate attemptId reuses without double charge
	dupUp, allowedDup, err := store.ReserveTurnTx(ctx, ReserveTurnInput{
		AttemptID: idUp, SessionID: "guest_rec", Role: contracts.RoleGuest, Mode: "qa",
		PromptHash: "hash-up", CorrelationID: "corr-up",
	})
	if err != nil || !allowedDup || !dupUp.Reused || dupUp.Quota.TurnsUsed != 1 {
		t.Fatalf("expected idempotent reuse, got reused=%v allowed=%v quota=%+v err=%v", dupUp.Reused, allowedDup, dupUp.Quota, err)
	}

	qAfterUp, err := store.ReconcileTurnTx(ctx, idUp, contracts.AskResponse{
		Grounded: true, Mode: "qa", Answer: "ok", Provider: "local", TokensUsed: 1234,
	})
	if err != nil || qAfterUp.TokensUsed != 1234 || qAfterUp.TurnsUsed != 1 {
		t.Fatalf("expected upward reconcile tokensUsed=1234, got %+v err=%v", qAfterUp, err)
	}

	// Downward delta reconciliation: reserved 512, actual 180 -> final session tokens 1234 + 180 = 1414
	idDown := "22222222-2222-4222-8222-222222222222"
	_, allowed, err = store.ReserveTurnTx(ctx, ReserveTurnInput{
		AttemptID: idDown, SessionID: "guest_rec", Role: contracts.RoleGuest, Mode: "qa",
		PromptHash: "hash-down", CorrelationID: "corr-down",
	})
	if err != nil || !allowed {
		t.Fatalf("reserve down failed: err=%v", err)
	}
	qAfterDown, err := store.ReconcileTurnTx(ctx, idDown, contracts.AskResponse{
		Grounded: false, Abstained: true, Mode: "qa", Answer: "abstain", Provider: "local", TokensUsed: 180,
	})
	if err != nil || qAfterDown.TokensUsed != 1414 || qAfterDown.TurnsUsed != 2 {
		t.Fatalf("expected downward credit-back total=1414, got %+v err=%v", qAfterDown, err)
	}

	// Refund decrements turn + reserved tokens cleanly and is idempotent
	idFail := "33333333-3333-4333-8333-333333333333"
	_, _, err = store.ReserveTurnTx(ctx, ReserveTurnInput{
		AttemptID: idFail, SessionID: "guest_rec", Role: contracts.RoleGuest, Mode: "qa",
		PromptHash: "hash-fail", CorrelationID: "corr-fail",
	})
	if err != nil {
		t.Fatalf("reserve fail turn err=%v", err)
	}
	qAfterRefund, err := store.RefundTurnTx(ctx, idFail, contracts.ErrCodeUpstreamUnavailable)
	if err != nil || qAfterRefund.TurnsUsed != 2 || qAfterRefund.TokensUsed != 1414 {
		t.Fatalf("expected exact refund back to turns=2 tokens=1414, got %+v err=%v", qAfterRefund, err)
	}

	// Expired lease rejects late ReconcileTurnTx and refunds once
	idLease := "44444444-4444-4444-8444-444444444444"
	_, _, err = store.ReserveTurnTx(ctx, ReserveTurnInput{
		AttemptID: idLease, SessionID: "guest_lease", Role: contracts.RoleGuest, Mode: "qa",
		PromptHash: "hash-lease", CorrelationID: "corr-lease",
	})
	if err != nil {
		t.Fatalf("reserve lease err=%v", err)
	}
	store.ExpireLeaseForTest(idLease, time.Now().UTC().Add(-90*time.Second))
	if _, err := store.ReconcileTurnTx(ctx, idLease, contracts.AskResponse{
		Grounded: true, Mode: "qa", Answer: "stale", Provider: "local", TokensUsed: 900,
	}); !errors.Is(err, ErrTurnLeaseExpired) {
		t.Fatalf("expected ErrTurnLeaseExpired on stale lease, got %v", err)
	}
	rec, qPoll, err := store.GetTurnByAttemptID(ctx, idLease, "guest_lease")
	if err != nil || rec.Status != contracts.TurnStatusExpired || qPoll.TurnsUsed != 0 || qPoll.TokensUsed != 0 {
		t.Fatalf("expected expired status and zeroed quota after lease refund, got rec=%+v q=%+v err=%v", rec, qPoll, err)
	}
}

type fakeSkillRows struct {
	pgx.Rows
	idx   int
	items []struct {
		slug, name, summary, url string
		tags                     []string
	}
	err error
}

func (r *fakeSkillRows) Close()     {}
func (r *fakeSkillRows) Err() error { return r.err }
func (r *fakeSkillRows) Next() bool {
	if r.idx >= len(r.items) {
		return false
	}
	r.idx++
	return true
}
func (r *fakeSkillRows) Scan(dest ...any) error {
	row := r.items[r.idx-1]
	*(dest[0].(*string)) = row.slug
	*(dest[1].(*string)) = row.name
	*(dest[2].(*string)) = row.summary
	*(dest[3].(*[]string)) = row.tags
	*(dest[4].(*string)) = row.url
	return nil
}

type stubQuerier struct {
	sqlSeen  string
	argsSeen []any
	rows     pgx.Rows
	err      error
}

func (q *stubQuerier) Query(_ context.Context, query string, args ...any) (pgx.Rows, error) {
	q.sqlSeen = query
	q.argsSeen = args
	return q.rows, q.err
}

func TestResolveAgensiCreatorHandleAndLoadQuery(t *testing.T) {
	t.Setenv("AGENSI_CREATOR_HANDLE", "")
	if got := ResolveAgensiCreatorHandle(); got != DefaultAgensiCreatorHandle {
		t.Fatalf("expected default %q, got %q", DefaultAgensiCreatorHandle, got)
	}
	t.Setenv("AGENSI_CREATOR_HANDLE", "  aklapper-custom ")
	if got := ResolveAgensiCreatorHandle(); got != "aklapper-custom" {
		t.Fatalf("expected trimmed handle, got %q", got)
	}

	q := &stubQuerier{
		rows: &fakeSkillRows{
			items: []struct {
				slug, name, summary, url string
				tags                     []string
			}{
				{
					slug:    "cadence-governed-agentic-sdlc-framework",
					name:    "CADENCE Framework",
					summary: "Governed SDLC.",
					tags:    []string{"sdlc"},
					url:     "https://agensi.io/skills/cadence-governed-agentic-sdlc-framework",
				},
			},
		},
	}

	docs, err := queryPublishedCreatorSkills(context.Background(), q, "aklapper")
	if err != nil {
		t.Fatalf("queryPublishedCreatorSkills failed: %v", err)
	}
	if !strings.Contains(q.sqlSeen, "lower(creator_handle) = lower($1)") || !strings.Contains(q.sqlSeen, "is_published = true") {
		t.Fatalf("expected creator_handle and is_published filter in SQL, got: %s", q.sqlSeen)
	}
	if len(q.argsSeen) != 1 || q.argsSeen[0] != "aklapper" {
		t.Fatalf("expected creator handle arg [aklapper], got %+v", q.argsSeen)
	}
	if len(docs) != 1 || docs[0].ID != "agensi:cadence-governed-agentic-sdlc-framework" {
		t.Fatalf("unexpected docs: %+v", docs)
	}

	// Query error fails closed instead of silently returning partial results
	errBoom := errors.New("pg connection lost")
	qFail := &stubQuerier{err: errBoom}
	if _, err := queryPublishedCreatorSkills(context.Background(), qFail, "aklapper"); !errors.Is(err, errBoom) {
		t.Fatalf("expected live SQL error propagation, got %v", err)
	}
}

func TestOpenBestEffortAndLoadCorpusErrorPropagation(t *testing.T) {
	t.Setenv("PG_DISABLE_LIVE", "false")
	t.Setenv("DATABASE_URL", "postgres://postgres:postgres@127.0.0.1:1/aklapper?sslmode=disable")

	degraded := OpenBestEffort(context.Background())
	if degraded.IsLivePG() {
		t.Fatal("expected IsLivePG() == false on unreachable PG")
	}
	if degraded.OpenError() == nil {
		t.Fatal("expected OpenBestEffort to record OpenError when PG_DISABLE_LIVE != true")
	}
	if _, err := degraded.LoadCorpusDocs(context.Background()); err == nil {
		t.Fatal("expected LoadCorpusDocs to fail fast when Store has OpenError")
	}

	t.Setenv("PG_DISABLE_LIVE", "true")
	disabled := OpenBestEffort(context.Background())
	if disabled.OpenError() != nil {
		t.Fatalf("expected nil OpenError when PG_DISABLE_LIVE=true, got %v", disabled.OpenError())
	}
	if docs, err := disabled.LoadCorpusDocs(context.Background()); err != nil || len(docs) < 4 {
		t.Fatalf("expected curated docs when PG_DISABLE_LIVE=true, got len=%d err=%v", len(docs), err)
	}

	if _, err := loadCorpusDocsFromQuerier(context.Background(), &stubCorpusQuerier{queryErr: errors.New("boom query")}, "aklapper", CuratedPortfolioDocs()); err == nil {
		t.Fatal("expected query error to propagate")
	}
	if _, err := loadCorpusDocsFromQuerier(context.Background(), &stubCorpusQuerier{scanErr: errors.New("boom scan")}, "aklapper", CuratedPortfolioDocs()); err == nil {
		t.Fatal("expected scan error to propagate")
	}
	if _, err := loadCorpusDocsFromQuerier(context.Background(), &stubCorpusQuerier{rowsErr: errors.New("boom rows")}, "aklapper", CuratedPortfolioDocs()); err == nil {
		t.Fatal("expected rows.Err() to propagate")
	}
}

func TestMemoryStorePendingRunLifecycleAndCAS(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	store := NewMemoryStore()
	store.SetPolicyForTest(QuotaPolicy{
		Role:                 contracts.RoleGuest,
		MaxTurnsPerSession:   1,
		MaxTokensPerRun:      4000,
		MaxDailyGlobalTokens: 10000,
	})

	preset, err := store.GetCadencePreset(ctx, "chord-pipeline-monitor")
	if err != nil || preset != nil {
		t.Fatalf("expected nil preset gracefully on memory store, got %+v err=%v", preset, err)
	}

	pendingRun, q1, allowed, err := store.CreatePendingSandboxRunWithQuota(ctx, contracts.RoleGuest, "sess-cas", 1, 800, PendingSandboxRunInput{
		SessionID:  "sess-cas",
		IPHash:     "portal-proxy",
		PresetSlug: "chord-pipeline-monitor",
		Prompt:     "Inspect pipeline turn durations",
		Mode:       contracts.CadenceModeFast,
	})
	if err != nil || !allowed || pendingRun == nil {
		t.Fatalf("expected pending run created, got allowed=%v run=%+v err=%v", allowed, pendingRun, err)
	}
	if pendingRun.Status != contracts.CadenceStatusPending || len(pendingRun.Turns) != 4 || q1.TurnsUsed != 1 {
		t.Fatalf("unexpected pending run: %+v quota=%+v", pendingRun, q1)
	}

	// Second request rejected on quota without creating orphan run.
	rejectedRun, _, allowed2, err := store.CreatePendingSandboxRunWithQuota(ctx, contracts.RoleGuest, "sess-cas", 1, 800, PendingSandboxRunInput{
		SessionID:  "sess-cas",
		PresetSlug: "custom",
		Prompt:     "Should not create orphan row",
		Mode:       contracts.CadenceModeFast,
	})
	if err != nil || allowed2 || rejectedRun != nil {
		t.Fatalf("expected quota rejection with nil run, got allowed=%v run=%+v err=%v", allowed2, rejectedRun, err)
	}

	// Concurrent CAS claims: strictly one claimant wins.
	var wg sync.WaitGroup
	wins := 0
	var mu sync.Mutex
	for range 4 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if claimedRun, ok, claimErr := store.ClaimPendingSandboxRun(ctx, pendingRun.RunID, "sess-cas"); claimErr == nil && ok && claimedRun != nil {
				mu.Lock()
				wins++
				mu.Unlock()
			}
		}()
	}
	wg.Wait()
	if wins != 1 {
		t.Fatalf("expected exactly 1 CAS winner, got %d", wins)
	}

	// Updating triage turn preserves mode payload key.
	updatedTurn, err := store.UpdateSandboxTurn(ctx, pendingRun.RunID, "triage", "completed", "Classified fast", 2, map[string]any{"promptLen": 31})
	if err != nil || updatedTurn.Payload["mode"] != contracts.CadenceModeFast {
		t.Fatalf("expected UpdateSandboxTurn to preserve mode, got %+v err=%v", updatedTurn, err)
	}

	completed, err := store.CompleteSandboxRun(ctx, pendingRun.RunID, 128, 360, "<html><body>Done</body></html>")
	if err != nil || completed.Status != contracts.CadenceStatusReady || completed.ArtifactHTML == "" {
		t.Fatalf("CompleteSandboxRun failed: %+v err=%v", completed, err)
	}

	if _, err := store.UpdateSandboxGateVerdictForSession(ctx, pendingRun.RunID, "", "approved"); !errors.Is(err, ErrForbiddenSession) {
		t.Fatalf("expected ErrForbiddenSession when sessionID empty, got %v", err)
	}
	if _, err := store.UpdateSandboxGateVerdictForSession(ctx, pendingRun.RunID, "other-sess", "approved"); !errors.Is(err, ErrForbiddenSession) {
		t.Fatalf("expected ErrForbiddenSession for wrong session, got %v", err)
	}
	gateOK, err := store.UpdateSandboxGateVerdictForSession(ctx, pendingRun.RunID, "sess-cas", "approved")
	if err != nil || gateOK.GateVerdict != "approved" {
		t.Fatalf("expected owner gate update to succeed, got %+v err=%v", gateOK, err)
	}

	if err := store.FailSandboxRun(ctx, pendingRun.RunID, "explicit fail test"); err != nil {
		t.Fatalf("FailSandboxRun failed: %v", err)
	}
	if _, err := store.UpdateSandboxGateVerdictForSession(ctx, pendingRun.RunID, "sess-cas", "rejected"); !errors.Is(err, ErrRunNotReady) {
		t.Fatalf("expected ErrRunNotReady on failed run, got %v", err)
	}
	fetched, err := store.GetSandboxRun(ctx, pendingRun.RunID)
	if err != nil || fetched.Status != contracts.CadenceStatusFailed {
		t.Fatalf("expected failed status after FailSandboxRun, got %+v err=%v", fetched, err)
	}
}
