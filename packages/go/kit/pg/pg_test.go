package pg

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
)

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

	overridden, err := store.OverrideSandboxGateVerdict(ctx, runID, "pending")
	if err != nil || overridden.GateVerdict != "pending" {
		t.Fatalf("OverrideSandboxGateVerdict(pending) failed: updated=%+v err=%v", overridden, err)
	}
	if _, err := store.OverrideSandboxGateVerdict(ctx, runID, "bogus"); !errors.Is(err, ErrInvalidAdminVerdict) {
		t.Fatalf("expected ErrInvalidAdminVerdict, got %v", err)
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
