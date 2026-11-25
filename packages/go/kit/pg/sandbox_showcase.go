package pg

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
	"github.com/jackc/pgx/v5"
)

const sandboxRunSelectColumns = `id::text, session_id, menu_slug, prompt, status, gate_verdict, tokens_in, tokens_out,
	COALESCE(artifact_html, ''), is_golden, COALESCE(prompt_hash, ''), execution_mode,
	COALESCE(spec_json::text, ''), COALESCE(gate_audit_json::text, ''), created_at`

type sandboxRowScanner interface {
	Scan(dest ...any) error
}

func scanSandboxRunFields(row sandboxRowScanner) (SandboxRun, error) {
	var r SandboxRun
	var specText, gateText string
	var createdAt time.Time
	if err := row.Scan(
		&r.RunID,
		&r.SessionID,
		&r.MenuSlug,
		&r.Prompt,
		&r.Status,
		&r.GateVerdict,
		&r.TokensIn,
		&r.TokensOut,
		&r.ArtifactHTML,
		&r.IsGolden,
		&r.PromptHash,
		&r.ExecutionMode,
		&specText,
		&gateText,
		&createdAt,
	); err != nil {
		return SandboxRun{}, err
	}
	if strings.TrimSpace(specText) != "" {
		var spec contracts.CadenceSpecArtifact
		if err := json.Unmarshal([]byte(specText), &spec); err == nil {
			r.SpecJSON = &spec
		}
	}
	if strings.TrimSpace(gateText) != "" {
		var audit contracts.CadenceGateAudit
		if err := json.Unmarshal([]byte(gateText), &audit); err == nil {
			r.GateAuditJSON = &audit
		}
	}
	r.CreatedAt = createdAt.UTC().Format(time.RFC3339)
	return r, nil
}

func marshalNullableJSON(v any) any {
	if v == nil {
		return nil
	}
	raw, err := json.Marshal(v)
	if err != nil {
		return nil
	}
	return string(raw)
}

func (s *Store) ListGoldenSandboxRuns(ctx context.Context) ([]SandboxRun, error) {
	if s == nil || s.pool == nil {
		if s == nil {
			return []SandboxRun{}, nil
		}
		s.mu.Lock()
		defer s.mu.Unlock()
		out := make([]SandboxRun, 0)
		for _, r := range s.runs {
			if !r.IsGolden {
				continue
			}
			copied := *r
			copied.Turns = append([]contracts.CadenceTurn(nil), r.Turns...)
			out = append(out, copied)
		}
		return out, nil
	}

	rows, err := s.pool.Query(
		ctx,
		`SELECT `+sandboxRunSelectColumns+`
		 FROM sandbox_runs
		 WHERE is_golden = true
		 ORDER BY id ASC`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	runs := []SandboxRun{}
	for rows.Next() {
		r, scanErr := scanSandboxRunFields(rows)
		if scanErr != nil {
			return nil, scanErr
		}
		r.Turns = []contracts.CadenceTurn{}
		runs = append(runs, r)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	for i := range runs {
		if turns, tErr := s.loadTurnsForRun(ctx, runs[i].RunID); tErr == nil {
			runs[i].Turns = turns
		}
	}
	return runs, nil
}

func (s *Store) FindCachedSandboxRun(
	ctx context.Context,
	promptHash, sessionID string,
	globalScope bool,
) (*SandboxRun, error) {
	trimmedHash := strings.TrimSpace(promptHash)
	if trimmedHash == "" || s == nil {
		return nil, nil
	}
	trimmedSession := strings.TrimSpace(sessionID)

	if s.pool == nil {
		s.mu.Lock()
		defer s.mu.Unlock()
		var best *SandboxRun
		for _, r := range s.runs {
			if r.Status != contracts.CadenceStatusReady || r.PromptHash != trimmedHash {
				continue
			}
			if globalScope {
				if r.ExecutionMode != contracts.CadenceExecutionModeLive &&
					r.ExecutionMode != contracts.CadenceExecutionModeFast &&
					r.ExecutionMode != contracts.CadenceExecutionModeGolden {
					continue
				}
			} else {
				if r.SessionID != trimmedSession {
					continue
				}
				if r.ExecutionMode != contracts.CadenceExecutionModeLive &&
					r.ExecutionMode != contracts.CadenceExecutionModeFast {
					continue
				}
			}
			if best == nil || (r.IsGolden && !best.IsGolden) {
				best = r
			}
		}
		if best == nil {
			return nil, nil
		}
		copied := *best
		copied.Turns = append([]contracts.CadenceTurn(nil), best.Turns...)
		return &copied, nil
	}

	var row pgx.Row
	if globalScope {
		row = s.pool.QueryRow(
			ctx,
			`SELECT `+sandboxRunSelectColumns+`
			 FROM sandbox_runs
			 WHERE prompt_hash = $1
			   AND status = 'ready'
			   AND execution_mode IN ('live', 'fast', 'golden')
			 ORDER BY is_golden DESC, created_at DESC
			 LIMIT 1`,
			trimmedHash,
		)
	} else {
		if trimmedSession == "" {
			return nil, nil
		}
		row = s.pool.QueryRow(
			ctx,
			`SELECT `+sandboxRunSelectColumns+`
			 FROM sandbox_runs
			 WHERE prompt_hash = $1
			   AND session_id = $2
			   AND status = 'ready'
			   AND execution_mode IN ('live', 'fast')
			 ORDER BY created_at DESC
			 LIMIT 1`,
			trimmedHash,
			trimmedSession,
		)
	}

	r, err := s.scanSandboxRunRow(ctx, row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return r, nil
}

func (s *Store) CloneCachedSandboxRunForSession(
	ctx context.Context,
	source *SandboxRun,
	sessionID, ipHash, menuSlug, prompt, promptHash string,
) (*SandboxRun, error) {
	if source == nil || s == nil {
		return nil, ErrRunNotFound
	}
	sessionID = normalizeSessionID(sessionID)
	if strings.TrimSpace(ipHash) == "" {
		ipHash = "portal-proxy"
	}
	if strings.TrimSpace(menuSlug) == "" {
		menuSlug = source.MenuSlug
	}
	if strings.TrimSpace(menuSlug) == "" {
		menuSlug = "custom"
	}

	if s.pool == nil {
		s.mu.Lock()
		defer s.mu.Unlock()
		runID := newUUIDv4()
		nowStr := time.Now().UTC().Format(time.RFC3339)
		turns := make([]contracts.CadenceTurn, 0, len(source.Turns))
		for _, t := range source.Turns {
			s.turnSeq++
			clonedTurn := t
			clonedTurn.ID = s.turnSeq
			clonedTurn.Payload = cloneTurnPayload(t.Payload)
			clonedTurn.CreatedAt = nowStr
			turns = append(turns, clonedTurn)
		}
		cloned := &SandboxRun{
			RunID:         runID,
			SessionID:     sessionID,
			MenuSlug:      menuSlug,
			Prompt:        prompt,
			Status:        contracts.CadenceStatusReady,
			GateVerdict:   "pending",
			TokensIn:      0,
			TokensOut:     0,
			ArtifactHTML:  source.ArtifactHTML,
			IsGolden:      false,
			PromptHash:    promptHash,
			ExecutionMode: contracts.CadenceExecutionModeCached,
			SpecJSON:      source.SpecJSON,
			GateAuditJSON: source.GateAuditJSON,
			Turns:         turns,
			CreatedAt:     nowStr,
		}
		s.runs = append([]*SandboxRun{cloned}, s.runs...)
		s.runsByID[runID] = cloned
		copied := *cloned
		copied.Turns = append([]contracts.CadenceTurn(nil), turns...)
		return &copied, nil
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	run, err := scanSandboxRunFields(
		tx.QueryRow(
			ctx,
			`INSERT INTO sandbox_runs
			 (session_id, ip_hash, menu_slug, prompt, status, gate_verdict, tokens_in, tokens_out,
			  artifact_html, is_golden, prompt_hash, execution_mode, spec_json, gate_audit_json)
			 VALUES ($1, $2, $3, $4, 'ready', 'pending', 0, 0, $5, false, $6, 'cached', $7::jsonb, $8::jsonb)
			 RETURNING `+sandboxRunSelectColumns,
			sessionID,
			ipHash,
			menuSlug,
			prompt,
			source.ArtifactHTML,
			promptHash,
			marshalNullableJSON(source.SpecJSON),
			marshalNullableJSON(source.GateAuditJSON),
		),
	)
	if err != nil {
		return nil, err
	}

	run.Turns = make([]contracts.CadenceTurn, 0, len(source.Turns))
	for _, turn := range source.Turns {
		payload := cloneTurnPayload(turn.Payload)
		if turn.Summary != "" {
			payload["summary"] = turn.Summary
		}
		rawJSON, mErr := json.Marshal(payload)
		if mErr != nil {
			return nil, mErr
		}
		var t contracts.CadenceTurn
		var tCreated time.Time
		if err := tx.QueryRow(
			ctx,
			`INSERT INTO sandbox_turns (run_id, phase, agent_name, status, payload_json, latency_ms)
			 VALUES ($1::uuid, $2, $3, $4, $5::jsonb, $6)
			 RETURNING id, created_at`,
			run.RunID,
			turn.Phase,
			turn.AgentName,
			turn.Status,
			string(rawJSON),
			turn.LatencyMs,
		).Scan(&t.ID, &tCreated); err != nil {
			return nil, err
		}
		t.Phase = turn.Phase
		t.AgentName = turn.AgentName
		t.Status = turn.Status
		t.Summary = turn.Summary
		t.LatencyMs = turn.LatencyMs
		t.Payload = payload
		t.CreatedAt = tCreated.UTC().Format(time.RFC3339)
		run.Turns = append(run.Turns, t)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return &run, nil
}

func extractReservedTokensFromTurns(turns []contracts.CadenceTurn) int {
	for _, t := range turns {
		if t.Phase != "triage" || t.Payload == nil {
			continue
		}
		switch v := t.Payload["reservedTokens"].(type) {
		case float64:
			if v > 0 {
				return int(v)
			}
		case int:
			if v > 0 {
				return v
			}
		}
	}
	return 800
}

// RefundSandboxRunQuotaTx atomically transitions a pending/running non-golden sandbox_runs row
// to 'failed' and refunds 1 turn + reservedTokens under strict lock ordering:
// 1) sandbox_runs FOR UPDATE -> 2) rate_limit_buckets session:<id> -> 3) global:<created_at UTC day>.
func (s *Store) RefundSandboxRunQuotaTx(ctx context.Context, runID string) (bool, error) {
	if s == nil {
		return false, nil
	}
	if s.pool == nil {
		s.mu.Lock()
		defer s.mu.Unlock()
		run, ok := s.runsByID[runID]
		if !ok || run.IsGolden || (run.Status != contracts.CadenceStatusPending && run.Status != contracts.CadenceStatusRunning) {
			return false, nil
		}
		run.Status = contracts.CadenceStatusFailed
		reserved := extractReservedTokensFromTurns(run.Turns)
		day := time.Now().UTC().Format("2006-01-02")
		if parsed, err := time.Parse(time.RFC3339, run.CreatedAt); err == nil {
			day = parsed.UTC().Format("2006-01-02")
		}
		for _, key := range []string{"session:" + run.SessionID, "global:" + day} {
			if b := s.buckets[key]; b != nil {
				b.turnsUsed = max(0, b.turnsUsed-1)
				b.tokensUsed = max(0, b.tokensUsed-reserved)
			}
		}
		return true, nil
	}

	if !isValidUUIDString(runID) {
		return false, nil
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return false, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var sessionID, status string
	var isGolden bool
	var createdAt time.Time
	err = tx.QueryRow(
		ctx,
		`SELECT session_id, status, is_golden, created_at
		 FROM sandbox_runs
		 WHERE id = $1::uuid
		 FOR UPDATE`,
		runID,
	).Scan(&sessionID, &status, &isGolden, &createdAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	if isGolden || (status != contracts.CadenceStatusPending && status != contracts.CadenceStatusRunning) {
		return false, nil
	}

	if _, err := tx.Exec(
		ctx,
		`UPDATE sandbox_runs SET status = 'failed' WHERE id = $1::uuid`,
		runID,
	); err != nil {
		return false, err
	}

	reservedTokens := 800
	var triagePayloadText string
	if tErr := tx.QueryRow(
		ctx,
		`SELECT payload_json::text FROM sandbox_turns WHERE run_id = $1::uuid AND phase = 'triage' LIMIT 1`,
		runID,
	).Scan(&triagePayloadText); tErr == nil {
		var payload map[string]any
		if json.Unmarshal([]byte(triagePayloadText), &payload) == nil {
			if raw, ok := payload["reservedTokens"].(float64); ok && raw >= 0 {
				reservedTokens = int(raw)
			}
		}
	}

	sessionKey := "session:" + normalizeSessionID(sessionID)
	globalKey := "global:" + createdAt.UTC().Format("2006-01-02")
	for _, key := range []string{sessionKey, globalKey} {
		var dummy int
		lockErr := tx.QueryRow(
			ctx,
			`SELECT turns_used FROM rate_limit_buckets WHERE scope_key = $1 FOR UPDATE`,
			key,
		).Scan(&dummy)
		if errors.Is(lockErr, pgx.ErrNoRows) {
			continue
		}
		if lockErr != nil {
			return false, lockErr
		}
		if _, err := tx.Exec(
			ctx,
			`UPDATE rate_limit_buckets
			 SET turns_used = GREATEST(0, turns_used - 1),
			     tokens_used = GREATEST(0, tokens_used - $2)
			 WHERE scope_key = $1`,
			key,
			reservedTokens,
		); err != nil {
			return false, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return false, err
	}
	return true, nil
}
