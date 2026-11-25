package pg

import (
	"context"
	"encoding/json"
	"log"
	"time"

	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
	"github.com/AndrewK4758/aklapper/packages/go/kit/llm"
)

const (
	MaxStreamWallClock       = 5 * time.Minute
	StreamLeaseRenewInterval = 30 * time.Second
)

func (s *Store) isDevUnlimitedEnabled() bool {
	if s != nil && s.DevUnlimitedFn != nil {
		return s.DevUnlimitedFn()
	}
	return llm.IsDevUnlimitedEnabled()
}

func logDevUnlimitedBypass(role, sessionID, attemptID, correlationID string) {
	raw, err := json.Marshal(map[string]any{
		"seam_type":     "DELTA_AUDIT_GAP",
		"event":         "ai_ask.turn.audit",
		"deltaStatus":   "dev_unlimited_bypass",
		"role":          role,
		"sessionId":     sessionID,
		"attemptId":     attemptID,
		"correlationId": correlationID,
	})
	if err == nil {
		log.Println(string(raw))
	}
}

func mapTurnErrorToPublicAppError(r TurnRecord) *contracts.PublicAppError {
	if r.Status != contracts.TurnStatusFailed && r.Status != contracts.TurnStatusExpired {
		return nil
	}
	code := r.ErrorCode
	status := 503
	msg := "Upstream service unreachable."
	action := "Retry shortly or go home."

	switch {
	case r.Status == contracts.TurnStatusExpired || code == contracts.ErrCodeStreamTimeout:
		code = contracts.ErrCodeStreamTimeout
		status = 504
		msg = "Section took too long to load."
		action = "Retry loading or refresh."
	case code == contracts.ErrCodeForbidden:
		status = 403
		msg = "Permission denied for action."
		action = "Return home or sign in again."
	case code == contracts.ErrCodeStreamAborted:
		status = 499
		msg = "Request cancelled early."
		action = "Retry if you still need this view."
	case code == "":
		code = contracts.ErrCodeUpstreamUnavailable
	}

	return &contracts.PublicAppError{
		Code:          code,
		Status:        status,
		Message:       msg,
		Action:        action,
		CorrelationID: r.CorrelationID,
	}
}

func clampExtendedLease(now, createdAt, expiresAt time.Time, extension time.Duration) time.Time {
	if extension <= 0 {
		extension = AskTurnLeaseDuration
	}
	candidate := now.Add(extension)
	maxWall := createdAt.Add(MaxStreamWallClock)
	if candidate.After(maxWall) {
		candidate = maxWall
	}
	if candidate.After(expiresAt) {
		candidate = expiresAt
	}
	return candidate
}

// ExtendTurnLeaseTx renews lease_expires_at for an active running/pending turn under row lock,
// clamping strictly to min(created_at + 5m, expires_at) and failing closed if already expired.
func (s *Store) ExtendTurnLeaseTx(ctx context.Context, attemptID string, extension time.Duration) (time.Time, error) {
	now := time.Now().UTC()
	if s == nil || s.pool == nil {
		return s.extendTurnLeaseMemory(now, attemptID, extension)
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return time.Time{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	row, err := lockAskTurnRow(ctx, tx, attemptID)
	if err != nil {
		return time.Time{}, err
	}
	if (row.Status != contracts.TurnStatusPending && row.Status != contracts.TurnStatusRunning) || !row.LeaseExpiresAt.After(now) {
		return time.Time{}, ErrTurnLeaseExpired
	}

	newLease := clampExtendedLease(now, row.CreatedAt, row.ExpiresAt, extension)
	if newLease.Before(row.LeaseExpiresAt) {
		newLease = row.LeaseExpiresAt
	}

	if _, err := tx.Exec(
		ctx,
		`UPDATE ask_turns SET lease_expires_at = $2, updated_at = $3 WHERE attempt_id = $1`,
		attemptID, newLease, now,
	); err != nil {
		return time.Time{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return time.Time{}, err
	}
	return newLease, nil
}
