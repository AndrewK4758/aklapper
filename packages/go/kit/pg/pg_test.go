package pg

import (
	"context"
	"errors"
	"testing"

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
