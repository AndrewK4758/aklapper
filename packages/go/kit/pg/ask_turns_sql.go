package pg

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
	"github.com/jackc/pgx/v5"
)

func (s *Store) ensureBucketsLocked(ctx context.Context, tx pgx.Tx, sessionKey, globalKey string) error {
	for _, key := range []string{sessionKey, globalKey} {
		if _, err := tx.Exec(
			ctx,
			`INSERT INTO rate_limit_buckets (scope_key, window_start, turns_used, tokens_used)
			 VALUES ($1, NOW(), 0, 0)
			 ON CONFLICT (scope_key) DO NOTHING`,
			key,
		); err != nil {
			return err
		}
	}
	return nil
}

func (s *Store) lockAndReadQuota(
	ctx context.Context,
	tx pgx.Tx,
	role, sessionKey, globalKey string,
) (QuotaPolicy, int, int, int, error) {
	policy := s.loadPolicy(ctx, tx, role)
	if err := s.ensureBucketsLocked(ctx, tx, sessionKey, globalKey); err != nil {
		return QuotaPolicy{}, 0, 0, 0, err
	}
	var sessionTurns, sessionTokens, globalTokens int
	if err := tx.QueryRow(
		ctx,
		`SELECT turns_used, tokens_used FROM rate_limit_buckets WHERE scope_key = $1 FOR UPDATE`,
		sessionKey,
	).Scan(&sessionTurns, &sessionTokens); err != nil {
		return QuotaPolicy{}, 0, 0, 0, err
	}
	if err := tx.QueryRow(
		ctx,
		`SELECT tokens_used FROM rate_limit_buckets WHERE scope_key = $1 FOR UPDATE`,
		globalKey,
	).Scan(&globalTokens); err != nil {
		return QuotaPolicy{}, 0, 0, 0, err
	}
	return policy, sessionTurns, sessionTokens, globalTokens, nil
}

func formatQuotaStatus(role string, policy QuotaPolicy, turnsUsed, tokensUsed int) contracts.QuotaStatus {
	return contracts.QuotaStatus{
		Role:       role,
		TurnsUsed:  turnsUsed,
		MaxTurns:   policy.MaxTurnsPerSession,
		TokensUsed: tokensUsed,
		MaxTokens:  policy.MaxTokensPerRun * policy.MaxTurnsPerSession,
	}
}

func (s *Store) refundLockedTurnPG(
	ctx context.Context,
	tx pgx.Tx,
	row *TurnRecord,
	terminalStatus, errorCode string,
) (contracts.QuotaStatus, error) {
	sessionKey := "session:" + row.SessionID
	globalKey := "global:" + row.CreatedAt.UTC().Format("2006-01-02")
	policy, turnsUsed, tokensUsed, _, err := s.lockAndReadQuota(ctx, tx, row.Role, sessionKey, globalKey)
	if err != nil {
		return contracts.QuotaStatus{}, err
	}
	for _, key := range []string{sessionKey, globalKey} {
		if _, err := tx.Exec(
			ctx,
			`UPDATE rate_limit_buckets SET turns_used = GREATEST(0, turns_used - 1), tokens_used = GREATEST(0, tokens_used - $2) WHERE scope_key = $1`,
			key, row.TokensReserved,
		); err != nil {
			return contracts.QuotaStatus{}, err
		}
	}
	if _, err := tx.Exec(
		ctx,
		`UPDATE ask_turns SET status = $2, tokens_used = 0, error_code = $3, updated_at = NOW() WHERE attempt_id = $1`,
		row.AttemptID, terminalStatus, strings.TrimSpace(errorCode),
	); err != nil {
		return contracts.QuotaStatus{}, err
	}
	return formatQuotaStatus(row.Role, policy, max(0, turnsUsed-1), max(0, tokensUsed-row.TokensReserved)), nil
}

func scanAskTurnRow(row pgx.Row) (*TurnRecord, error) {
	var rec TurnRecord
	var resultText, errorCode, convID, promptText *string
	var turnIndex *int
	err := row.Scan(
		&rec.AttemptID, &rec.SessionID, &rec.Role, &rec.Mode, &rec.PromptHash, &rec.Status,
		&rec.TokensReserved, &rec.TokensUsed, &resultText, &errorCode, &rec.CorrelationID,
		&rec.CreatedAt, &rec.UpdatedAt, &rec.LeaseExpiresAt, &rec.ExpiresAt,
		&convID, &turnIndex, &promptText,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrTurnNotFound
	}
	if err != nil {
		return nil, err
	}
	if errorCode != nil {
		rec.ErrorCode = *errorCode
	}
	if convID != nil {
		rec.ConversationID = *convID
	}
	if turnIndex != nil {
		rec.TurnIndex = *turnIndex
	}
	if promptText != nil {
		rec.PromptText = *promptText
	}
	if resultText != nil && *resultText != "" {
		var parsed contracts.AskResponse
		if unmarshalErr := json.Unmarshal([]byte(*resultText), &parsed); unmarshalErr != nil {
			return nil, fmt.Errorf("decode ask_turns result_json: %w", unmarshalErr)
		}
		rec.Result = &parsed
	}
	return &rec, nil
}

const selectAskTurnColsSQL = `SELECT attempt_id, session_id, role, mode, prompt_hash, status, tokens_reserved, tokens_used,
        result_json::text, error_code, correlation_id, created_at, updated_at, lease_expires_at, expires_at,
        conversation_id, turn_index, prompt_text
 FROM ask_turns WHERE attempt_id = $1`

func readAskTurnRowNoLock(ctx context.Context, tx pgx.Tx, attemptID string) (*TurnRecord, error) {
	return scanAskTurnRow(tx.QueryRow(ctx, selectAskTurnColsSQL, attemptID))
}

func lockAskTurnRow(ctx context.Context, tx pgx.Tx, attemptID string) (*TurnRecord, error) {
	return scanAskTurnRow(tx.QueryRow(ctx, selectAskTurnColsSQL+" FOR UPDATE", attemptID))
}

func (s *Store) reuseCommittedRaceTurn(
	ctx context.Context,
	tx pgx.Tx,
	in ReserveTurnInput,
	raced *TurnRecord,
	role, sessionID string,
	policy QuotaPolicy,
	sessionTurns, sessionTokens int,
	now time.Time,
) (TurnReservation, bool, error) {
	if raced.SessionID != sessionID || raced.PromptHash != in.PromptHash {
		return TurnReservation{}, false, ErrTurnConflict
	}
	if (raced.Status == contracts.TurnStatusPending || raced.Status == contracts.TurnStatusRunning) &&
		!raced.LeaseExpiresAt.After(now) {
		_ = tx.Rollback(ctx)
		turn, quota, getErr := s.GetTurnByAttemptID(ctx, in.AttemptID, sessionID)
		if getErr != nil {
			return TurnReservation{}, false, getErr
		}
		return TurnReservation{Turn: *turn, Quota: quota, Reused: true}, true, nil
	}
	if err := tx.Commit(ctx); err != nil {
		return TurnReservation{}, false, err
	}
	return TurnReservation{
		Turn:   *raced,
		Quota:  formatQuotaStatus(role, policy, sessionTurns, sessionTokens),
		Reused: true,
	}, true, nil
}
