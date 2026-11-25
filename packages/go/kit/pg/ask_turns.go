package pg

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
	"github.com/jackc/pgx/v5"
)

const (
	DefaultAskTurnReserveTokens = 512
	AskTurnLeaseDuration        = 60 * time.Second
	AskTurnRecoveryTTL          = 15 * time.Minute
)

var (
	ErrTurnNotFound     = errors.New("ask turn not found")
	ErrTurnLeaseExpired = errors.New("ask turn lease expired or already finalized")
	ErrTurnConflict     = errors.New("ask turn payload conflicts with existing attemptId")
)

type ReserveTurnInput struct {
	AttemptID     string
	SessionID     string
	Role          string
	Mode          string
	PromptHash    string
	CorrelationID string
	ReserveTokens int
}

type TurnRecord struct {
	AttemptID      string
	SessionID      string
	Role           string
	Mode           string
	PromptHash     string
	Status         string
	TokensReserved int
	TokensUsed     int
	Result         *contracts.AskResponse
	ErrorCode      string
	CorrelationID  string
	CreatedAt      time.Time
	UpdatedAt      time.Time
	LeaseExpiresAt time.Time
	ExpiresAt      time.Time
}

type TurnReservation struct {
	Turn   TurnRecord
	Quota  contracts.QuotaStatus
	Reused bool
}

func (r TurnRecord) ToState(quota *contracts.QuotaStatus) contracts.AskTurnState {
	state := contracts.AskTurnState{
		AttemptID:      r.AttemptID,
		Status:         r.Status,
		Mode:           r.Mode,
		CorrelationID:  r.CorrelationID,
		LeaseExpiresAt: r.LeaseExpiresAt.UTC().Format(time.RFC3339),
		ExpiresAt:      r.ExpiresAt.UTC().Format(time.RFC3339),
		Quota:          quota,
		Response:       r.Result,
	}
	if r.Status == contracts.TurnStatusFailed || r.Status == contracts.TurnStatusExpired {
		code := r.ErrorCode
		status := 503
		msg := "Upstream service unreachable."
		action := "Retry shortly or go home."
		if r.Status == contracts.TurnStatusExpired || code == contracts.ErrCodeStreamTimeout {
			code = contracts.ErrCodeStreamTimeout
			status = 504
			msg = "Section took too long to load."
			action = "Retry loading or refresh."
		} else if code == "" {
			code = contracts.ErrCodeUpstreamUnavailable
		}
		state.Error = &contracts.PublicAppError{
			Code:          code,
			Status:        status,
			Message:       msg,
			Action:        action,
			CorrelationID: r.CorrelationID,
		}
	}
	return state
}

func (s *Store) ReserveTurnTx(ctx context.Context, in ReserveTurnInput) (TurnReservation, bool, error) {
	role := normalizeRole(in.Role)
	sessionID := normalizeSessionID(in.SessionID)
	reserveTokens := in.ReserveTokens
	if reserveTokens <= 0 {
		reserveTokens = DefaultAskTurnReserveTokens
	}
	now := time.Now().UTC()

	if s == nil || s.pool == nil {
		return s.reserveTurnMemory(now, in, role, sessionID, reserveTokens)
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return TurnReservation{}, false, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	existing, findErr := lockAskTurnRow(ctx, tx, in.AttemptID)
	if findErr != nil && !errors.Is(findErr, ErrTurnNotFound) {
		return TurnReservation{}, false, findErr
	}
	sessionKey := "session:" + sessionID
	globalKey := "global:" + now.Format("2006-01-02")

	if findErr == nil {
		if existing.SessionID != sessionID || existing.PromptHash != in.PromptHash {
			return TurnReservation{}, false, ErrTurnConflict
		}
		if (existing.Status == contracts.TurnStatusPending || existing.Status == contracts.TurnStatusRunning) &&
			!existing.LeaseExpiresAt.After(now) {
			quota, refundErr := s.refundLockedTurnPG(ctx, tx, existing, contracts.TurnStatusExpired, contracts.ErrCodeStreamTimeout)
			if refundErr != nil {
				return TurnReservation{}, false, refundErr
			}
			existing.Status = contracts.TurnStatusExpired
			existing.ErrorCode = contracts.ErrCodeStreamTimeout
			if err := tx.Commit(ctx); err != nil {
				return TurnReservation{}, false, err
			}
			return TurnReservation{Turn: *existing, Quota: quota, Reused: true}, true, nil
		}
		_, turnsUsed, tokensUsed, _, qErr := s.lockAndReadQuota(ctx, tx, role, sessionKey, globalKey)
		if qErr != nil {
			return TurnReservation{}, false, qErr
		}
		policy := s.loadPolicy(ctx, tx, role)
		if err := tx.Commit(ctx); err != nil {
			return TurnReservation{}, false, err
		}
		return TurnReservation{Turn: *existing, Quota: formatQuotaStatus(role, policy, turnsUsed, tokensUsed), Reused: true}, true, nil
	}

	policy, sessionTurns, sessionTokens, globalTokens, err := s.lockAndReadQuota(ctx, tx, role, sessionKey, globalKey)
	if err != nil {
		return TurnReservation{}, false, err
	}
	// Re-check under the serialized session quota lock without inverting ask_turns -> session lock order.
	racedTurn, racedErr := readAskTurnRowNoLock(ctx, tx, in.AttemptID)
	if racedErr != nil && !errors.Is(racedErr, ErrTurnNotFound) {
		return TurnReservation{}, false, racedErr
	}
	if racedErr == nil {
		return s.reuseCommittedRaceTurn(ctx, tx, in, racedTurn, role, sessionID, policy, sessionTurns, sessionTokens, now)
	}
	if sessionTurns+1 > policy.MaxTurnsPerSession ||
		reserveTokens > policy.MaxTokensPerRun ||
		globalTokens+reserveTokens > policy.MaxDailyGlobalTokens {
		return TurnReservation{Quota: formatQuotaStatus(role, policy, sessionTurns, sessionTokens)}, false, nil
	}

	leaseExp := now.Add(AskTurnLeaseDuration)
	exp := now.Add(AskTurnRecoveryTTL)
	var insertedID string
	err = tx.QueryRow(
		ctx,
		`INSERT INTO ask_turns
		 (attempt_id, session_id, role, mode, prompt_hash, status, tokens_reserved, tokens_used, correlation_id, created_at, updated_at, lease_expires_at, expires_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, 0, $8, $9, $9, $10, $11)
		 ON CONFLICT (attempt_id) DO NOTHING
		 RETURNING attempt_id`,
		in.AttemptID, sessionID, role, in.Mode, in.PromptHash, contracts.TurnStatusRunning,
		reserveTokens, in.CorrelationID, now, leaseExp, exp,
	).Scan(&insertedID)
	if errors.Is(err, pgx.ErrNoRows) {
		_ = tx.Rollback(ctx)
		turn, quota, getErr := s.GetTurnByAttemptID(ctx, in.AttemptID, sessionID)
		if getErr != nil {
			return TurnReservation{}, false, ErrTurnConflict
		}
		if turn.PromptHash != in.PromptHash {
			return TurnReservation{}, false, ErrTurnConflict
		}
		return TurnReservation{Turn: *turn, Quota: quota, Reused: true}, true, nil
	}
	if err != nil {
		return TurnReservation{}, false, err
	}

	for _, key := range []string{sessionKey, globalKey} {
		if _, err := tx.Exec(
			ctx,
			`UPDATE rate_limit_buckets SET turns_used = turns_used + 1, tokens_used = tokens_used + $2 WHERE scope_key = $1`,
			key, reserveTokens,
		); err != nil {
			return TurnReservation{}, false, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return TurnReservation{}, false, err
	}

	quota := formatQuotaStatus(role, policy, sessionTurns+1, sessionTokens+reserveTokens)
	return TurnReservation{
		Turn: TurnRecord{
			AttemptID:      in.AttemptID,
			SessionID:      sessionID,
			Role:           role,
			Mode:           in.Mode,
			PromptHash:     in.PromptHash,
			Status:         contracts.TurnStatusRunning,
			TokensReserved: reserveTokens,
			CorrelationID:  in.CorrelationID,
			CreatedAt:      now,
			UpdatedAt:      now,
			LeaseExpiresAt: leaseExp,
			ExpiresAt:      exp,
		},
		Quota: quota,
	}, true, nil
}

func (s *Store) ReconcileTurnTx(ctx context.Context, attemptID string, res contracts.AskResponse) (contracts.QuotaStatus, error) {
	now := time.Now().UTC()
	if s == nil || s.pool == nil {
		return s.reconcileTurnMemory(now, attemptID, res)
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return contracts.QuotaStatus{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	row, err := lockAskTurnRow(ctx, tx, attemptID)
	if err != nil {
		return contracts.QuotaStatus{}, err
	}
	if row.Status != contracts.TurnStatusPending && row.Status != contracts.TurnStatusRunning {
		return contracts.QuotaStatus{}, ErrTurnLeaseExpired
	}
	if !row.LeaseExpiresAt.After(now) {
		if _, refundErr := s.refundLockedTurnPG(ctx, tx, row, contracts.TurnStatusExpired, contracts.ErrCodeStreamTimeout); refundErr != nil {
			return contracts.QuotaStatus{}, refundErr
		}
		if err := tx.Commit(ctx); err != nil {
			return contracts.QuotaStatus{}, err
		}
		return contracts.QuotaStatus{}, ErrTurnLeaseExpired
	}

	sessionKey := "session:" + row.SessionID
	globalKey := "global:" + row.CreatedAt.UTC().Format("2006-01-02")
	policy, turnsUsed, sessionTokens, _, err := s.lockAndReadQuota(ctx, tx, row.Role, sessionKey, globalKey)
	if err != nil {
		return contracts.QuotaStatus{}, err
	}

	delta := res.TokensUsed - row.TokensReserved
	for _, key := range []string{sessionKey, globalKey} {
		if _, err := tx.Exec(
			ctx,
			`UPDATE rate_limit_buckets SET tokens_used = GREATEST(0, tokens_used + $2) WHERE scope_key = $1`,
			key, delta,
		); err != nil {
			return contracts.QuotaStatus{}, err
		}
	}

	finalSessionTokens := max(0, sessionTokens+delta)
	updatedQuota := formatQuotaStatus(row.Role, policy, turnsUsed, finalSessionTokens)
	res.AttemptID = row.AttemptID
	res.Quota = &updatedQuota

	status := contracts.TurnStatusCompleted
	if !res.Grounded || res.Abstained {
		status = contracts.TurnStatusAbstained
	}
	rawJSON, err := json.Marshal(res)
	if err != nil {
		return contracts.QuotaStatus{}, err
	}

	if _, err := tx.Exec(
		ctx,
		`UPDATE ask_turns SET status = $2, tokens_used = $3, result_json = $4::jsonb, updated_at = $5 WHERE attempt_id = $1`,
		attemptID, status, res.TokensUsed, string(rawJSON), now,
	); err != nil {
		return contracts.QuotaStatus{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return contracts.QuotaStatus{}, err
	}
	return updatedQuota, nil
}

func (s *Store) RefundTurnTx(ctx context.Context, attemptID, errorCode string) (contracts.QuotaStatus, error) {
	now := time.Now().UTC()
	if s == nil || s.pool == nil {
		return s.refundTurnMemory(now, attemptID, errorCode)
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return contracts.QuotaStatus{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	row, err := lockAskTurnRow(ctx, tx, attemptID)
	if err != nil {
		return contracts.QuotaStatus{}, err
	}
	if row.Status != contracts.TurnStatusPending && row.Status != contracts.TurnStatusRunning {
		sessionKey := "session:" + row.SessionID
		globalKey := "global:" + row.CreatedAt.UTC().Format("2006-01-02")
		policy, turnsUsed, tokensUsed, _, qErr := s.lockAndReadQuota(ctx, tx, row.Role, sessionKey, globalKey)
		if qErr != nil {
			return contracts.QuotaStatus{}, qErr
		}
		if err := tx.Commit(ctx); err != nil {
			return contracts.QuotaStatus{}, err
		}
		return formatQuotaStatus(row.Role, policy, turnsUsed, tokensUsed), nil
	}

	quota, err := s.refundLockedTurnPG(ctx, tx, row, contracts.TurnStatusFailed, errorCode)
	if err != nil {
		return contracts.QuotaStatus{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return contracts.QuotaStatus{}, err
	}
	return quota, nil
}

func (s *Store) GetTurnByAttemptID(ctx context.Context, attemptID, sessionID string) (*TurnRecord, contracts.QuotaStatus, error) {
	now := time.Now().UTC()
	sessionID = normalizeSessionID(sessionID)

	if s == nil || s.pool == nil {
		return s.getTurnMemory(now, attemptID, sessionID)
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, contracts.QuotaStatus{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	row, err := lockAskTurnRow(ctx, tx, attemptID)
	if err != nil {
		return nil, contracts.QuotaStatus{}, err
	}
	if row.SessionID != sessionID || !row.ExpiresAt.After(now) {
		return nil, contracts.QuotaStatus{}, ErrTurnNotFound
	}

	var quota contracts.QuotaStatus
	if (row.Status == contracts.TurnStatusPending || row.Status == contracts.TurnStatusRunning) &&
		!row.LeaseExpiresAt.After(now) {
		quota, err = s.refundLockedTurnPG(ctx, tx, row, contracts.TurnStatusExpired, contracts.ErrCodeStreamTimeout)
		if err != nil {
			return nil, contracts.QuotaStatus{}, err
		}
		row.Status = contracts.TurnStatusExpired
		row.ErrorCode = contracts.ErrCodeStreamTimeout
		row.UpdatedAt = now
	} else {
		sessionKey := "session:" + row.SessionID
		globalKey := "global:" + row.CreatedAt.UTC().Format("2006-01-02")
		policy, turnsUsed, tokensUsed, _, qErr := s.lockAndReadQuota(ctx, tx, row.Role, sessionKey, globalKey)
		if qErr != nil {
			return nil, contracts.QuotaStatus{}, qErr
		}
		quota = formatQuotaStatus(row.Role, policy, turnsUsed, tokensUsed)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, contracts.QuotaStatus{}, err
	}
	return row, quota, nil
}
