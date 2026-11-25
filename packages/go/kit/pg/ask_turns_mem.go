package pg

import (
	"strings"
	"time"

	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
)

func (s *Store) ensureMemStateLocked(role, sessionID, day string) (QuotaPolicy, *memBucket, *memBucket) {
	if s.policies == nil {
		s.policies = defaultPolicies()
	}
	if s.buckets == nil {
		s.buckets = make(map[string]*memBucket)
	}
	if s.turns == nil {
		s.turns = make(map[string]*TurnRecord)
	}
	policy, ok := s.policies[role]
	if !ok {
		policy = defaultPolicies()[role]
	}
	sKey := "session:" + sessionID
	gKey := "global:" + day
	sb := s.buckets[sKey]
	if sb == nil {
		sb = &memBucket{windowDay: day}
		s.buckets[sKey] = sb
	}
	gb := s.buckets[gKey]
	if gb == nil || gb.windowDay != day {
		gb = &memBucket{windowDay: day}
		s.buckets[gKey] = gb
	}
	return policy, sb, gb
}

func (s *Store) reserveTurnMemory(
	now time.Time,
	in ReserveTurnInput,
	role, sessionID string,
	reserveTokens int,
) (TurnReservation, bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	day := now.Format("2006-01-02")
	policy, sb, gb := s.ensureMemStateLocked(role, sessionID, day)

	if existing, ok := s.turns[in.AttemptID]; ok {
		if existing.SessionID != sessionID || existing.PromptHash != in.PromptHash {
			return TurnReservation{}, false, ErrTurnConflict
		}
		if (existing.Status == contracts.TurnStatusPending || existing.Status == contracts.TurnStatusRunning) &&
			!existing.LeaseExpiresAt.After(now) {
			sb.turnsUsed = max(0, sb.turnsUsed-1)
			sb.tokensUsed = max(0, sb.tokensUsed-existing.TokensReserved)
			gb.turnsUsed = max(0, gb.turnsUsed-1)
			gb.tokensUsed = max(0, gb.tokensUsed-existing.TokensReserved)
			existing.Status = contracts.TurnStatusExpired
			existing.ErrorCode = contracts.ErrCodeStreamTimeout
		}
		copied := *existing
		return TurnReservation{Turn: copied, Quota: formatQuotaStatus(role, policy, sb.turnsUsed, sb.tokensUsed), Reused: true}, true, nil
	}

	if sb.turnsUsed+1 > policy.MaxTurnsPerSession ||
		reserveTokens > policy.MaxTokensPerRun ||
		gb.tokensUsed+reserveTokens > policy.MaxDailyGlobalTokens {
		if !s.isDevUnlimitedEnabled() {
			return TurnReservation{Quota: formatQuotaStatus(role, policy, sb.turnsUsed, sb.tokensUsed)}, false, nil
		}
		logDevUnlimitedBypass(role, sessionID, in.AttemptID, in.CorrelationID)
	}

	sb.turnsUsed++
	sb.tokensUsed += reserveTokens
	gb.turnsUsed++
	gb.tokensUsed += reserveTokens

	convID := strings.TrimSpace(in.ConversationID)
	turnIndex := 0
	if convID != "" {
		maxIdx := 0
		for _, existing := range s.turns {
			if existing.SessionID == sessionID && existing.ConversationID == convID && existing.TurnIndex > maxIdx {
				maxIdx = existing.TurnIndex
			}
		}
		turnIndex = maxIdx + 1
	}

	rec := &TurnRecord{
		AttemptID:      in.AttemptID,
		SessionID:      sessionID,
		Role:           role,
		Mode:           in.Mode,
		PromptHash:     in.PromptHash,
		ConversationID: convID,
		TurnIndex:      turnIndex,
		PromptText:     truncateRunes(in.PromptText, MaxPromptTextRunes),
		Status:         contracts.TurnStatusRunning,
		TokensReserved: reserveTokens,
		CorrelationID:  in.CorrelationID,
		CreatedAt:      now,
		UpdatedAt:      now,
		LeaseExpiresAt: now.Add(AskTurnLeaseDuration),
		ExpiresAt:      now.Add(AskTurnRecoveryTTL),
	}
	s.turns[in.AttemptID] = rec
	copied := *rec
	return TurnReservation{Turn: copied, Quota: formatQuotaStatus(role, policy, sb.turnsUsed, sb.tokensUsed)}, true, nil
}

func (s *Store) reconcileTurnMemory(now time.Time, attemptID string, res contracts.AskResponse) (contracts.QuotaStatus, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	rec, ok := s.turns[attemptID]
	if !ok {
		return contracts.QuotaStatus{}, ErrTurnNotFound
	}
	if rec.Status != contracts.TurnStatusPending && rec.Status != contracts.TurnStatusRunning {
		return contracts.QuotaStatus{}, ErrTurnLeaseExpired
	}
	policy, sb, gb := s.ensureMemStateLocked(rec.Role, rec.SessionID, rec.CreatedAt.UTC().Format("2006-01-02"))
	if !rec.LeaseExpiresAt.After(now) {
		sb.turnsUsed = max(0, sb.turnsUsed-1)
		sb.tokensUsed = max(0, sb.tokensUsed-rec.TokensReserved)
		gb.turnsUsed = max(0, gb.turnsUsed-1)
		gb.tokensUsed = max(0, gb.tokensUsed-rec.TokensReserved)
		rec.Status = contracts.TurnStatusExpired
		rec.ErrorCode = contracts.ErrCodeStreamTimeout
		rec.UpdatedAt = now
		return contracts.QuotaStatus{}, ErrTurnLeaseExpired
	}

	delta := res.TokensUsed - rec.TokensReserved
	sb.tokensUsed = max(0, sb.tokensUsed+delta)
	gb.tokensUsed = max(0, gb.tokensUsed+delta)

	quota := formatQuotaStatus(rec.Role, policy, sb.turnsUsed, sb.tokensUsed)
	res.AttemptID = rec.AttemptID
	res.Quota = &quota
	resCopy := res
	rec.Result = &resCopy
	rec.TokensUsed = res.TokensUsed
	rec.UpdatedAt = now
	rec.Status = contracts.TurnStatusCompleted
	if res.Abstained {
		rec.Status = contracts.TurnStatusAbstained
	}
	return quota, nil
}

func (s *Store) refundTurnMemory(now time.Time, attemptID, errorCode string) (contracts.QuotaStatus, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	rec, ok := s.turns[attemptID]
	if !ok {
		return contracts.QuotaStatus{}, ErrTurnNotFound
	}
	policy, sb, gb := s.ensureMemStateLocked(rec.Role, rec.SessionID, rec.CreatedAt.UTC().Format("2006-01-02"))
	if rec.Status != contracts.TurnStatusPending && rec.Status != contracts.TurnStatusRunning {
		return formatQuotaStatus(rec.Role, policy, sb.turnsUsed, sb.tokensUsed), nil
	}
	sb.turnsUsed = max(0, sb.turnsUsed-1)
	sb.tokensUsed = max(0, sb.tokensUsed-rec.TokensReserved)
	gb.turnsUsed = max(0, gb.turnsUsed-1)
	gb.tokensUsed = max(0, gb.tokensUsed-rec.TokensReserved)
	rec.Status = contracts.TurnStatusFailed
	rec.ErrorCode = errorCode
	rec.TokensUsed = 0
	rec.UpdatedAt = now
	return formatQuotaStatus(rec.Role, policy, sb.turnsUsed, sb.tokensUsed), nil
}

func (s *Store) getTurnMemory(now time.Time, attemptID, sessionID string) (*TurnRecord, contracts.QuotaStatus, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	rec, ok := s.turns[attemptID]
	if !ok || rec.SessionID != sessionID || !rec.ExpiresAt.After(now) {
		return nil, contracts.QuotaStatus{}, ErrTurnNotFound
	}
	policy, sb, gb := s.ensureMemStateLocked(rec.Role, rec.SessionID, rec.CreatedAt.UTC().Format("2006-01-02"))
	if (rec.Status == contracts.TurnStatusPending || rec.Status == contracts.TurnStatusRunning) &&
		!rec.LeaseExpiresAt.After(now) {
		sb.turnsUsed = max(0, sb.turnsUsed-1)
		sb.tokensUsed = max(0, sb.tokensUsed-rec.TokensReserved)
		gb.turnsUsed = max(0, gb.turnsUsed-1)
		gb.tokensUsed = max(0, gb.tokensUsed-rec.TokensReserved)
		rec.Status = contracts.TurnStatusExpired
		rec.ErrorCode = contracts.ErrCodeStreamTimeout
		rec.UpdatedAt = now
	}
	copied := *rec
	return &copied, formatQuotaStatus(rec.Role, policy, sb.turnsUsed, sb.tokensUsed), nil
}

func (s *Store) extendTurnLeaseMemory(now time.Time, attemptID string, extension time.Duration) (time.Time, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	rec, ok := s.turns[attemptID]
	if !ok {
		return time.Time{}, ErrTurnNotFound
	}
	if (rec.Status != contracts.TurnStatusPending && rec.Status != contracts.TurnStatusRunning) || !rec.LeaseExpiresAt.After(now) {
		return time.Time{}, ErrTurnLeaseExpired
	}
	newLease := clampExtendedLease(now, rec.CreatedAt, rec.ExpiresAt, extension)
	if newLease.Before(rec.LeaseExpiresAt) {
		newLease = rec.LeaseExpiresAt
	}
	rec.LeaseExpiresAt = newLease
	rec.UpdatedAt = now
	return newLease, nil
}

// ExpireLeaseForTest backdates leaseExpiresAt in memory store for unit testing execution-lease expiry.
func (s *Store) ExpireLeaseForTest(attemptID string, expiredAt time.Time) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if rec, ok := s.turns[attemptID]; ok {
		rec.LeaseExpiresAt = expiredAt
	}
}
