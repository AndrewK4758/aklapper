package pg

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
)

func TestExtendTurnLeaseAndDevUnlimitedAndErrorMappings(t *testing.T) {
	t.Run("DevUnlimited bypasses quota cap in local dev while recording ask_turns and usage", func(t *testing.T) {
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
}
