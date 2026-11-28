package pg

import (
	"context"
	"errors"
	"os"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
	"github.com/jackc/pgx/v5"
)

func resolveConversationTurnArgs(
	ctx context.Context,
	tx pgx.Tx,
	sessionID, rawConvID, rawPrompt string,
) (string, *string, int, *int, string, *string, error) {
	convID := strings.TrimSpace(rawConvID)
	var convIDArg *string
	var turnIndex int
	var turnIndexArg *int
	if convID != "" {
		convIDArg = &convID
		if err := tx.QueryRow(
			ctx,
			`SELECT COALESCE(MAX(turn_index), 0) + 1 FROM ask_turns WHERE session_id = $1 AND conversation_id = $2`,
			sessionID, convID,
		).Scan(&turnIndex); err != nil {
			return "", nil, 0, nil, "", nil, err
		}
		turnIndexArg = &turnIndex
	}
	promptText := truncateRunes(rawPrompt, MaxPromptTextRunes)
	var promptTextArg *string
	if promptText != "" {
		promptTextArg = &promptText
	}
	return convID, convIDArg, turnIndex, turnIndexArg, promptText, promptTextArg, nil
}

const (
	DefaultExpiredTurnPruneLimit = 200
	DefaultAskTurnRetentionDays  = 90
	MaxPromptTextRunes           = 1000
)

// ResolveAskTurnRetentionDays parses ASK_TURN_RETENTION_DAYS (>= 1), defaulting to 90 days.
func ResolveAskTurnRetentionDays() int {
	raw := strings.TrimSpace(os.Getenv("ASK_TURN_RETENTION_DAYS"))
	if raw == "" {
		return DefaultAskTurnRetentionDays
	}
	parsed, err := strconv.Atoi(raw)
	if err != nil || parsed < 1 {
		return DefaultAskTurnRetentionDays
	}
	return parsed
}

type ConversationHistoryTurn struct {
	AttemptID      string
	ConversationID string
	TurnIndex      int
	PromptText     string
	AnswerText     string
	Status         string
	CreatedAt      time.Time
}

// PruneExpiredTerminalAskTurns deletes a bounded batch of terminal ask_turns rows older than
// the configured analytics retention window (default 90 days via ASK_TURN_RETENTION_DAYS)
// outside the quota-lock transaction using FOR UPDATE SKIP LOCKED, while preserving the
// 15-minute expires_at recovery/recall TTL enforced by GetTurnByAttemptID and ListConversationHistory.
func (s *Store) PruneExpiredTerminalAskTurns(ctx context.Context, limit int) (int, error) {
	if s == nil {
		return 0, nil
	}
	if limit <= 0 {
		limit = DefaultExpiredTurnPruneLimit
	}
	retentionDays := ResolveAskTurnRetentionDays()
	if s.pool == nil {
		cutoff := time.Now().UTC().Add(-time.Duration(retentionDays) * 24 * time.Hour)
		s.mu.Lock()
		defer s.mu.Unlock()
		deleted := 0
		for id, rec := range s.turns {
			if deleted >= limit {
				break
			}
			if isTerminalTurnStatus(rec.Status) && rec.CreatedAt.Before(cutoff) {
				delete(s.turns, id)
				deleted++
			}
		}
		return deleted, nil
	}

	tag, err := s.pool.Exec(
		ctx,
		`DELETE FROM ask_turns
		 WHERE attempt_id IN (
		   SELECT attempt_id FROM ask_turns
		   WHERE status IN ('completed', 'abstained', 'failed', 'expired')
		     AND created_at < NOW() - make_interval(days => $2)
		   ORDER BY created_at ASC
		   LIMIT $1
		   FOR UPDATE SKIP LOCKED
		 )`,
		limit,
		retentionDays,
	)
	if err != nil {
		return 0, err
	}
	return int(tag.RowsAffected()), nil
}

func isTerminalTurnStatus(status string) bool {
	switch status {
	case contracts.TurnStatusCompleted, contracts.TurnStatusAbstained, contracts.TurnStatusFailed, contracts.TurnStatusExpired:
		return true
	default:
		return false
	}
}

// ListConversationHistory returns up to limit recent completed/abstained turns scoped strictly
// to (sessionID, conversationID) with active TTL, ordered chronologically (turn_index ASC).
func (s *Store) ListConversationHistory(
	ctx context.Context,
	sessionID, conversationID string,
	limit int,
) ([]ConversationHistoryTurn, error) {
	sessionID = normalizeSessionID(sessionID)
	conversationID = strings.TrimSpace(conversationID)
	if s == nil || conversationID == "" {
		return nil, nil
	}
	if limit <= 0 {
		limit = 6
	}
	if s.pool == nil {
		now := time.Now().UTC()
		s.mu.Lock()
		defer s.mu.Unlock()
		var out []ConversationHistoryTurn
		for _, rec := range s.turns {
			if rec.SessionID != sessionID || rec.ConversationID != conversationID {
				continue
			}
			if !rec.ExpiresAt.After(now) {
				continue
			}
			if rec.Status != contracts.TurnStatusCompleted && rec.Status != contracts.TurnStatusAbstained {
				continue
			}
			answer := ""
			if rec.Result != nil {
				answer = rec.Result.Answer
			}
			out = append(out, ConversationHistoryTurn{
				AttemptID:      rec.AttemptID,
				ConversationID: rec.ConversationID,
				TurnIndex:      rec.TurnIndex,
				PromptText:     rec.PromptText,
				AnswerText:     answer,
				Status:         rec.Status,
				CreatedAt:      rec.CreatedAt,
			})
		}
		sort.Slice(out, func(i, j int) bool {
			if out[i].TurnIndex != out[j].TurnIndex {
				return out[i].TurnIndex > out[j].TurnIndex
			}
			return out[i].CreatedAt.After(out[j].CreatedAt)
		})
		if len(out) > limit {
			out = out[:limit]
		}
		for i, j := 0, len(out)-1; i < j; i, j = i+1, j-1 {
			out[i], out[j] = out[j], out[i]
		}
		return out, nil
	}

	rows, err := s.pool.Query(
		ctx,
		`SELECT attempt_id, conversation_id, COALESCE(turn_index, 0), COALESCE(prompt_text, ''),
		        COALESCE(result_json->>'answer', ''), status, created_at
		 FROM ask_turns
		 WHERE session_id = $1
		   AND conversation_id = $2
		   AND expires_at > NOW()
		   AND status IN ('completed', 'abstained')
		 ORDER BY turn_index DESC NULLS LAST, created_at DESC
		 LIMIT $3`,
		sessionID, conversationID, limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var turns []ConversationHistoryTurn
	for rows.Next() {
		var t ConversationHistoryTurn
		if scanErr := rows.Scan(
			&t.AttemptID, &t.ConversationID, &t.TurnIndex, &t.PromptText, &t.AnswerText, &t.Status, &t.CreatedAt,
		); scanErr != nil {
			return nil, scanErr
		}
		turns = append(turns, t)
	}
	if rowsErr := rows.Err(); rowsErr != nil {
		return nil, rowsErr
	}
	// Reverse to chronological order (oldest -> newest).
	for i, j := 0, len(turns)-1; i < j; i, j = i+1, j-1 {
		turns[i], turns[j] = turns[j], turns[i]
	}
	return turns, nil
}

// ReconcilePartialAbortTurnTx records actual tokens streamed before a mid-stream abort under
// status = 'failed' (so it is excluded from future conversation recall while preserving exact
// single-turn quota accounting).
func (s *Store) ReconcilePartialAbortTurnTx(
	ctx context.Context,
	attemptID string,
	tokensUsed int,
	errorCode string,
) (contracts.QuotaStatus, error) {
	if tokensUsed < 0 {
		tokensUsed = 0
	}
	code := strings.TrimSpace(errorCode)
	if code == "" {
		code = contracts.ErrCodeStreamAborted
	}
	now := time.Now().UTC()
	if s == nil || s.pool == nil {
		return s.reconcilePartialAbortMemory(now, attemptID, tokensUsed, code)
	}

	tx, row, err := s.beginAndLockAskTurn(ctx, attemptID)
	if err != nil {
		return contracts.QuotaStatus{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if row.Status != contracts.TurnStatusPending && row.Status != contracts.TurnStatusRunning {
		return s.commitReadOnlyQuotaStatus(ctx, tx, row)
	}

	sessionKey := "session:" + row.SessionID
	globalKey := "global:" + row.CreatedAt.UTC().Format("2006-01-02")
	policy, turnsUsed, sessionTokens, _, err := s.lockAndReadQuota(ctx, tx, row.Role, sessionKey, globalKey)
	if err != nil {
		return contracts.QuotaStatus{}, err
	}

	delta := tokensUsed - row.TokensReserved
	for _, key := range []string{sessionKey, globalKey} {
		if _, err := tx.Exec(
			ctx,
			`UPDATE rate_limit_buckets SET tokens_used = GREATEST(0, tokens_used + $2) WHERE scope_key = $1`,
			key, delta,
		); err != nil {
			return contracts.QuotaStatus{}, err
		}
	}

	if _, err := tx.Exec(
		ctx,
		`UPDATE ask_turns SET status = $2, tokens_used = $3, error_code = $4, updated_at = $5 WHERE attempt_id = $1`,
		attemptID, contracts.TurnStatusFailed, tokensUsed, code, now,
	); err != nil {
		return contracts.QuotaStatus{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return contracts.QuotaStatus{}, err
	}
	return formatQuotaStatus(row.Role, policy, turnsUsed, max(0, sessionTokens+delta)), nil
}

func (s *Store) reconcilePartialAbortMemory(
	now time.Time,
	attemptID string,
	tokensUsed int,
	errorCode string,
) (contracts.QuotaStatus, error) {
	if s == nil {
		return contracts.QuotaStatus{}, errors.New("store is nil")
	}
	return s.withLockedActiveMemTurn(attemptID, func(rec *TurnRecord, sb, gb *memBucket) {
		delta := tokensUsed - rec.TokensReserved
		sb.tokensUsed = max(0, sb.tokensUsed+delta)
		gb.tokensUsed = max(0, gb.tokensUsed+delta)
		rec.Status = contracts.TurnStatusFailed
		rec.TokensUsed = tokensUsed
		rec.ErrorCode = errorCode
		rec.UpdatedAt = now
	})
}
