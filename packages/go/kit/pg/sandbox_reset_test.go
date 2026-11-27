package pg

import (
	"context"
	"testing"

	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
)

func TestClearSandboxRunsForSessionPreservesGoldenAndOtherSessions(t *testing.T) {
	store := NewMemoryStore()
	ctx := context.Background()

	goldenID, err := store.CreateSandboxRun(ctx, SandboxRunInput{
		SessionID:     "guest_alpha123",
		MenuSlug:      "chord-decomposition-workbench",
		Prompt:        "Golden showcase run",
		Status:        contracts.CadenceStatusReady,
		GateVerdict:   "approved",
		IsGolden:      true,
		ExecutionMode: contracts.CadenceExecutionModeGolden,
	})
	if err != nil {
		t.Fatalf("create golden run: %v", err)
	}
	alphaID, err := store.CreateSandboxRun(ctx, SandboxRunInput{
		SessionID:     "guest_alpha123",
		MenuSlug:      "custom",
		Prompt:        "Alpha custom run",
		Status:        contracts.CadenceStatusReady,
		GateVerdict:   "pending",
		IsGolden:      false,
		ExecutionMode: contracts.CadenceExecutionModeFast,
	})
	if err != nil {
		t.Fatalf("create alpha run: %v", err)
	}
	otherID, err := store.CreateSandboxRun(ctx, SandboxRunInput{
		SessionID:     "guest_other999",
		MenuSlug:      "custom",
		Prompt:        "Other custom run",
		Status:        contracts.CadenceStatusReady,
		GateVerdict:   "pending",
		IsGolden:      false,
		ExecutionMode: contracts.CadenceExecutionModeFast,
	})
	if err != nil {
		t.Fatalf("create other run: %v", err)
	}

	deleted, err := store.ClearSandboxRunsForSession(ctx, "guest_alpha123")
	if err != nil || deleted != 1 {
		t.Fatalf("expected deleted=1 err=nil, got deleted=%d err=%v", deleted, err)
	}

	if _, err := store.GetSandboxRun(ctx, alphaID); err == nil {
		t.Fatalf("expected alpha non-golden run %s to be deleted", alphaID)
	}
	if _, err := store.GetSandboxRun(ctx, goldenID); err != nil {
		t.Fatalf("expected golden run %s preserved, got err=%v", goldenID, err)
	}
	if _, err := store.GetSandboxRun(ctx, otherID); err != nil {
		t.Fatalf("expected other session run %s preserved, got err=%v", otherID, err)
	}
}
