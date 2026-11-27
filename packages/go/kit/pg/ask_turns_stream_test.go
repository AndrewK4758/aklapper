package pg

import (
	"context"
	"errors"
	"log"
	"strings"
	"testing"
	"time"

	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
)

func TestExtendTurnLeaseAndDevUnlimitedAndErrorMappings(t *testing.T) {
	t.Run("DevUnlimited bypasses quota cap in local dev while recording ask_turns, usage, and audit log", func(t *testing.T) {
		var logs strings.Builder
		prevOut := log.Writer()
		log.SetOutput(&logs)
		defer log.SetOutput(prevOut)

		store := NewMemoryStore()
		store.SetPolicyForTest(QuotaPolicy{
			Role: contracts.RoleGuest, MaxTurnsPerSession: 1, MaxTokensPerRun: 4000, MaxDailyGlobalTokens: 100000,
		})
		store.DevUnlimitedFn = func() bool { return true }

		res1, ok1, err := store.ReserveTurnTx(context.Background(), ReserveTurnInput{
			AttemptID: "11111111-1111-4111-8111-111111111101", SessionID: "sess-dev", Role: contracts.RoleGuest,
			Mode: "qa", PromptHash: "h1", CorrelationID: "c1", ReserveTokens: 512,
		})
		if err != nil || !ok1 || res1.Quota.TurnsUsed != 1 {
			t.Fatalf("turn 1 failed: res=%+v ok=%v err=%v", res1, ok1, err)
		}

		res2, ok2, err := store.ReserveTurnTx(context.Background(), ReserveTurnInput{
			AttemptID: "11111111-1111-4111-8111-111111111102", SessionID: "sess-dev", Role: contracts.RoleGuest,
			Mode: "qa", PromptHash: "h2", CorrelationID: "c2", ReserveTokens: 512,
		})
		if err != nil || !ok2 || res2.Quota.TurnsUsed != 2 {
			t.Fatalf("turn 2 under DevUnlimited should succeed and persist turn/counters: res=%+v ok=%v err=%v", res2, ok2, err)
		}
		logText := logs.String()
		if !strings.Contains(logText, `"seam_type":"DELTA_AUDIT_GAP"`) ||
			!strings.Contains(logText, `"event":"ai_ask.turn.audit"`) ||
			!strings.Contains(logText, `"deltaStatus":"dev_unlimited_bypass"`) {
			t.Fatalf("expected DELTA_AUDIT_GAP ai_ask.turn.audit dev_unlimited_bypass log, got %s", logText)
		}

		// When disabled (prod/vertex), quota cap rejects turn 3
		store.DevUnlimitedFn = func() bool { return false }
		_, ok3, err := store.ReserveTurnTx(context.Background(), ReserveTurnInput{
			AttemptID: "11111111-1111-4111-8111-111111111103", SessionID: "sess-dev", Role: contracts.RoleGuest,
			Mode: "qa", PromptHash: "h3", CorrelationID: "c3", ReserveTokens: 512,
		})
		if err != nil || ok3 {
			t.Fatalf("expected turn 3 rejected when DevUnlimited disabled, got ok=%v err=%v", ok3, err)
		}
	})

	t.Run("ExtendTurnLeaseTx extends active lease capped at 5m and rejects expired turns", func(t *testing.T) {
		store := NewMemoryStore()
		attemptID := "22222222-2222-4222-8222-222222222201"
		res, ok, err := store.ReserveTurnTx(context.Background(), ReserveTurnInput{
			AttemptID: attemptID, SessionID: "sess-lease", Role: contracts.RoleGuest,
			Mode: "qa", PromptHash: "hl", CorrelationID: "cl", ReserveTokens: 512,
		})
		if err != nil || !ok {
			t.Fatalf("reserve failed: %v", err)
		}

		extended, err := store.ExtendTurnLeaseTx(context.Background(), attemptID, 90*time.Second)
		if err != nil {
			t.Fatalf("ExtendTurnLeaseTx failed: %v", err)
		}
		if !extended.After(res.Turn.LeaseExpiresAt) {
			t.Fatalf("expected extended lease %v after initial %v", extended, res.Turn.LeaseExpiresAt)
		}

		// Capped at CreatedAt + 5m
		capped, err := store.ExtendTurnLeaseTx(context.Background(), attemptID, 20*time.Minute)
		if err != nil {
			t.Fatalf("ExtendTurnLeaseTx cap check failed: %v", err)
		}
		maxCap := res.Turn.CreatedAt.Add(MaxStreamWallClock)
		if capped.After(maxCap) {
			t.Fatalf("expected lease capped at %v, got %v", maxCap, capped)
		}

		// Expired lease fails closed
		store.ExpireLeaseForTest(attemptID, time.Now().UTC().Add(-time.Second))
		if _, err := store.ExtendTurnLeaseTx(context.Background(), attemptID, time.Minute); !errors.Is(err, ErrTurnLeaseExpired) {
			t.Fatalf("expected ErrTurnLeaseExpired on expired lease, got %v", err)
		}
	})

	t.Run("TurnRecord.ToState maps ERR_FORBIDDEN (403) and ERR_STREAM_ABORTED (499) accurately", func(t *testing.T) {
		forb := TurnRecord{
			AttemptID: "a1", Status: contracts.TurnStatusFailed, ErrorCode: contracts.ErrCodeForbidden,
			CorrelationID: "c-forb", LeaseExpiresAt: time.Now(), ExpiresAt: time.Now(),
		}.ToState(nil)
		if forb.Error == nil || forb.Error.Status != 403 || forb.Error.Code != contracts.ErrCodeForbidden {
			t.Fatalf("expected 403 ERR_FORBIDDEN, got %+v", forb.Error)
		}

		aborted := TurnRecord{
			AttemptID: "a2", Status: contracts.TurnStatusFailed, ErrorCode: contracts.ErrCodeStreamAborted,
			CorrelationID: "c-abort", LeaseExpiresAt: time.Now(), ExpiresAt: time.Now(),
		}.ToState(nil)
		if aborted.Error == nil || aborted.Error.Status != 499 || aborted.Error.Code != contracts.ErrCodeStreamAborted {
			t.Fatalf("expected 499 ERR_STREAM_ABORTED, got %+v", aborted.Error)
		}
	})

	t.Run("ReconcileTurnTx marks non-abstained general turns as completed and abstained turns as abstained", func(t *testing.T) {
		store := NewMemoryStore()
		generalAttempt := "33333333-3333-4333-8333-333333333301"
		if _, ok, err := store.ReserveTurnTx(context.Background(), ReserveTurnInput{
			AttemptID: generalAttempt, SessionID: "sess-tier", Role: contracts.RoleGuest,
			Mode: "qa", PromptHash: "h-gen", CorrelationID: "c-gen", ReserveTokens: 512,
		}); err != nil || !ok {
			t.Fatalf("reserve general turn failed: ok=%v err=%v", ok, err)
		}
		if _, err := store.ReconcileTurnTx(context.Background(), generalAttempt, contracts.AskResponse{
			Grounded:      false,
			Abstained:     false,
			GroundingTier: contracts.GroundingTierGeneral,
			Mode:          "qa",
			Answer:        "Happy to chat! Andrew focuses on distributed systems and streaming SSR.",
			Sources:       []contracts.AskSource{},
			Provider:      "local",
			TokensUsed:    48,
		}); err != nil {
			t.Fatalf("reconcile general turn failed: %v", err)
		}
		recGen, _, err := store.GetTurnByAttemptID(context.Background(), generalAttempt, "sess-tier")
		if err != nil || recGen.Status != contracts.TurnStatusCompleted || recGen.TokensUsed != 48 {
			t.Fatalf("expected general turn completed with 48 tokens, got rec=%+v err=%v", recGen, err)
		}

		abstainAttempt := "33333333-3333-4333-8333-333333333302"
		if _, ok, err := store.ReserveTurnTx(context.Background(), ReserveTurnInput{
			AttemptID: abstainAttempt, SessionID: "sess-tier", Role: contracts.RoleGuest,
			Mode: "qa", PromptHash: "h-abs", CorrelationID: "c-abs", ReserveTokens: 512,
		}); err != nil || !ok {
			t.Fatalf("reserve abstained turn failed: ok=%v err=%v", ok, err)
		}
		if _, err := store.ReconcileTurnTx(context.Background(), abstainAttempt, contracts.AskResponse{
			Grounded:      false,
			Abstained:     true,
			GroundingTier: contracts.GroundingTierBoundary,
			Mode:          "qa",
			Answer:        "Abstaining: boundary probe.",
			Sources:       []contracts.AskSource{},
			Provider:      "local",
			TokensUsed:    0,
		}); err != nil {
			t.Fatalf("reconcile abstained turn failed: %v", err)
		}
		recAbs, _, err := store.GetTurnByAttemptID(context.Background(), abstainAttempt, "sess-tier")
		if err != nil || recAbs.Status != contracts.TurnStatusAbstained {
			t.Fatalf("expected boundary turn abstained, got rec=%+v err=%v", recAbs, err)
		}
	})

	t.Run("PruneExpiredTerminalAskTurns retains recent expired turns for 90-day analytics while enforcing 15m recovery TTL", func(t *testing.T) {
		store := NewMemoryStore()
		ctx := context.Background()
		now := time.Now().UTC()
		convID := "44444444-4444-4444-8444-444444444499"
		recentID := "44444444-4444-4444-8444-444444444401"
		agedID := "44444444-4444-4444-8444-444444444402"
		pendingAgedID := "44444444-4444-4444-8444-444444444403"

		for _, tc := range []struct {
			id   string
			hash string
		}{
			{recentID, "h-recent"},
			{agedID, "h-aged"},
			{pendingAgedID, "h-pending-aged"},
		} {
			if _, ok, err := store.ReserveTurnTx(ctx, ReserveTurnInput{
				AttemptID: tc.id, SessionID: "sess-ret", Role: contracts.RoleGuest,
				Mode: "qa", ConversationID: convID, PromptText: "Prompt " + tc.id, PromptHash: tc.hash, CorrelationID: "c-" + tc.id,
			}); err != nil || !ok {
				t.Fatalf("reserve %s failed: ok=%v err=%v", tc.id, ok, err)
			}
		}
		for _, id := range []string{recentID, agedID} {
			if _, err := store.ReconcileTurnTx(ctx, id, contracts.AskResponse{
				Grounded: true, Mode: "qa", Answer: "ok", Provider: "local", TokensUsed: 25,
			}); err != nil {
				t.Fatalf("reconcile %s failed: %v", id, err)
			}
		}

		// Backdate timestamps: recentID expired 5m ago (created 20m ago); agedID & pendingAgedID created 91d ago
		store.mu.Lock()
		store.turns[recentID].CreatedAt = now.Add(-20 * time.Minute)
		store.turns[recentID].ExpiresAt = now.Add(-5 * time.Minute)
		store.turns[agedID].CreatedAt = now.AddDate(0, 0, -91)
		store.turns[agedID].ExpiresAt = now.AddDate(0, 0, -90)
		store.turns[pendingAgedID].CreatedAt = now.AddDate(0, 0, -91)
		store.turns[pendingAgedID].ExpiresAt = now.AddDate(0, 0, -90)
		store.mu.Unlock()

		// 15-min recovery/recall strictly rejects expired recentID
		if _, _, err := store.GetTurnByAttemptID(ctx, recentID, "sess-ret"); !errors.Is(err, ErrTurnNotFound) {
			t.Fatalf("expected ErrTurnNotFound for expired recentID, got %v", err)
		}
		hist, err := store.ListConversationHistory(ctx, "sess-ret", convID, 6)
		if err != nil || len(hist) != 0 {
			t.Fatalf("expected 0 expired turns in ListConversationHistory, got %+v err=%v", hist, err)
		}

		// 90-day terminal retention prunes agedID only, retaining recentID and pendingAgedID
		deleted, err := store.PruneExpiredTerminalAskTurns(ctx, 50)
		if err != nil || deleted != 1 {
			t.Fatalf("expected exactly 1 aged terminal turn pruned, got deleted=%d err=%v", deleted, err)
		}
		store.mu.Lock()
		_, hasRecent := store.turns[recentID]
		_, hasAged := store.turns[agedID]
		_, hasPendingAged := store.turns[pendingAgedID]
		store.mu.Unlock()
		if !hasRecent || hasAged || !hasPendingAged {
			t.Fatalf("unexpected retention state: hasRecent=%v hasAged=%v hasPendingAged=%v", hasRecent, hasAged, hasPendingAged)
		}
	})
}
