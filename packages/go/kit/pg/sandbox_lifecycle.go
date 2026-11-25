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

var (
	ErrForbiddenSession = errors.New("sandbox run belongs to a different session")
	ErrRunNotReady      = errors.New("sandbox run is not ready for gate verdict")
)

type CadencePresetRecord = contracts.CadencePreset

type PendingSandboxRunInput struct {
	SessionID  string
	IPHash     string
	PresetSlug string
	Prompt     string
	Mode       string
}

var chordPhaseSpecs = []struct {
	Phase     string
	AgentName string
}{
	{Phase: "triage", AgentName: "chord-triage"},
	{Phase: "spec", AgentName: "chord-spec"},
	{Phase: "build", AgentName: "chord-builder"},
	{Phase: "gate", AgentName: "chord-gate"},
}

func cloneTurnPayload(src map[string]any) map[string]any {
	if len(src) == 0 {
		return map[string]any{}
	}
	dst := make(map[string]any, len(src))
	for k, v := range src {
		dst[k] = v
	}
	return dst
}

func (s *Store) scanSandboxRunRow(ctx context.Context, row pgx.Row) (*SandboxRun, error) {
	var r SandboxRun
	var createdAt time.Time
	err := row.Scan(
		&r.RunID,
		&r.SessionID,
		&r.MenuSlug,
		&r.Prompt,
		&r.Status,
		&r.GateVerdict,
		&r.TokensIn,
		&r.TokensOut,
		&r.ArtifactHTML,
		&createdAt,
	)
	if err != nil {
		return nil, err
	}
	r.CreatedAt = createdAt.UTC().Format(time.RFC3339)
	turns, _ := s.loadTurnsForRun(ctx, r.RunID)
	r.Turns = turns
	return &r, nil
}

func (s *Store) GetSandboxRun(ctx context.Context, runID string) (*SandboxRun, error) {
	if s == nil {
		return nil, ErrRunNotFound
	}
	if s.pool == nil {
		s.mu.Lock()
		defer s.mu.Unlock()
		run, ok := s.runsByID[runID]
		if !ok {
			return nil, ErrRunNotFound
		}
		copied := *run
		copied.Turns = append([]contracts.CadenceTurn(nil), run.Turns...)
		return &copied, nil
	}

	if !isValidUUIDString(runID) {
		return nil, ErrRunNotFound
	}

	r, err := s.scanSandboxRunRow(
		ctx,
		s.pool.QueryRow(
			ctx,
			`SELECT id::text, session_id, menu_slug, prompt, status, gate_verdict, tokens_in, tokens_out, COALESCE(artifact_html, ''), created_at
			 FROM sandbox_runs
			 WHERE id = $1::uuid`,
			runID,
		),
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrRunNotFound
	}
	return r, err
}

func (s *Store) ClaimPendingSandboxRun(ctx context.Context, runID, sessionID string) (*SandboxRun, bool, error) {
	if s == nil {
		return nil, false, nil
	}
	if s.pool == nil {
		s.mu.Lock()
		defer s.mu.Unlock()
		run, ok := s.runsByID[runID]
		if !ok || run.SessionID != sessionID || run.Status != contracts.CadenceStatusPending {
			return nil, false, nil
		}
		run.Status = contracts.CadenceStatusRunning
		copied := *run
		copied.Turns = append([]contracts.CadenceTurn(nil), run.Turns...)
		return &copied, true, nil
	}

	if !isValidUUIDString(runID) {
		return nil, false, nil
	}

	r, err := s.scanSandboxRunRow(
		ctx,
		s.pool.QueryRow(
			ctx,
			`UPDATE sandbox_runs
			 SET status = 'running'
			 WHERE id = $1::uuid AND session_id = $2 AND status = 'pending'
			 RETURNING id::text, session_id, menu_slug, prompt, status, gate_verdict, tokens_in, tokens_out, COALESCE(artifact_html, ''), created_at`,
			runID,
			sessionID,
		),
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, false, nil
	}
	if err != nil {
		return nil, false, err
	}
	return r, true, nil
}

func (s *Store) UpdateSandboxTurn(
	ctx context.Context,
	runID, phase, status, summary string,
	latencyMs int,
	payload map[string]any,
) (contracts.CadenceTurn, error) {
	patch := cloneTurnPayload(payload)
	if summary != "" {
		patch["summary"] = summary
	}

	if s == nil || s.pool == nil {
		if s == nil {
			return contracts.CadenceTurn{}, ErrRunNotFound
		}
		s.mu.Lock()
		defer s.mu.Unlock()
		run, ok := s.runsByID[runID]
		if !ok {
			return contracts.CadenceTurn{}, ErrRunNotFound
		}
		for i := range run.Turns {
			if run.Turns[i].Phase == phase {
				merged := cloneTurnPayload(run.Turns[i].Payload)
				for k, v := range patch {
					merged[k] = v
				}
				run.Turns[i].Status = status
				run.Turns[i].Summary = summary
				run.Turns[i].LatencyMs = latencyMs
				run.Turns[i].Payload = merged
				out := run.Turns[i]
				out.Payload = cloneTurnPayload(merged)
				return out, nil
			}
		}
		return contracts.CadenceTurn{}, ErrRunNotFound
	}

	rawJSON, err := json.Marshal(patch)
	if err != nil {
		return contracts.CadenceTurn{}, err
	}

	var t contracts.CadenceTurn
	var payloadText string
	var createdAt time.Time
	err = s.pool.QueryRow(
		ctx,
		`UPDATE sandbox_turns
		 SET status = $3,
		     latency_ms = $4,
		     payload_json = COALESCE(payload_json, '{}'::jsonb) || $5::jsonb
		 WHERE run_id = $1::uuid AND phase = $2
		 RETURNING id, phase, agent_name, status, payload_json::text, latency_ms, created_at`,
		runID,
		phase,
		status,
		latencyMs,
		string(rawJSON),
	).Scan(&t.ID, &t.Phase, &t.AgentName, &t.Status, &payloadText, &t.LatencyMs, &createdAt)
	if err != nil {
		return contracts.CadenceTurn{}, err
	}
	var merged map[string]any
	_ = json.Unmarshal([]byte(payloadText), &merged)
	t.Payload = merged
	if sVal, ok := merged["summary"].(string); ok {
		t.Summary = sVal
	} else {
		t.Summary = summary
	}
	t.CreatedAt = createdAt.UTC().Format(time.RFC3339)
	return t, nil
}

func (s *Store) CompleteSandboxRun(ctx context.Context, runID string, tokensIn, tokensOut int, artifactHTML string) (*SandboxRun, error) {
	if s == nil {
		return nil, ErrRunNotFound
	}
	if s.pool == nil {
		s.mu.Lock()
		defer s.mu.Unlock()
		run, ok := s.runsByID[runID]
		if !ok {
			return nil, ErrRunNotFound
		}
		run.Status = contracts.CadenceStatusReady
		run.TokensIn = tokensIn
		run.TokensOut = tokensOut
		run.ArtifactHTML = artifactHTML
		copied := *run
		copied.Turns = append([]contracts.CadenceTurn(nil), run.Turns...)
		return &copied, nil
	}

	if !isValidUUIDString(runID) {
		return nil, ErrRunNotFound
	}

	r, err := s.scanSandboxRunRow(
		ctx,
		s.pool.QueryRow(
			ctx,
			`UPDATE sandbox_runs
			 SET status = 'ready', tokens_in = $2, tokens_out = $3, artifact_html = $4
			 WHERE id = $1::uuid
			 RETURNING id::text, session_id, menu_slug, prompt, status, gate_verdict, tokens_in, tokens_out, COALESCE(artifact_html, ''), created_at`,
			runID,
			tokensIn,
			tokensOut,
			artifactHTML,
		),
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrRunNotFound
	}
	return r, err
}

func (s *Store) FailSandboxRun(ctx context.Context, runID, reason string) error {
	if s == nil || s.pool == nil {
		if s == nil {
			return nil
		}
		s.mu.Lock()
		defer s.mu.Unlock()
		if run, ok := s.runsByID[runID]; ok {
			run.Status = contracts.CadenceStatusFailed
			if strings.TrimSpace(reason) != "" {
				for i := range run.Turns {
					if run.Turns[i].Status == contracts.CadenceStatusRunning {
						run.Turns[i].Status = contracts.CadenceStatusFailed
						run.Turns[i].Summary = reason
					}
				}
			}
		}
		return nil
	}

	if !isValidUUIDString(runID) {
		return nil
	}

	if _, err := s.pool.Exec(ctx, `UPDATE sandbox_runs SET status = 'failed' WHERE id = $1::uuid`, runID); err != nil {
		return err
	}
	if strings.TrimSpace(reason) != "" {
		rawPatch, _ := json.Marshal(map[string]any{"summary": reason})
		_, _ = s.pool.Exec(
			ctx,
			`UPDATE sandbox_turns
			 SET status = 'failed',
			     payload_json = COALESCE(payload_json, '{}'::jsonb) || $2::jsonb
			 WHERE run_id = $1::uuid AND status = 'running'`,
			runID,
			string(rawPatch),
		)
	}
	return nil
}

func (s *Store) UpdateSandboxGateVerdictForSession(ctx context.Context, runID, sessionID, verdict string) (*SandboxRun, error) {
	if s == nil {
		return nil, ErrRunNotFound
	}
	if verdict != "approved" && verdict != "rejected" {
		return nil, ErrInvalidVerdict
	}
	trimmedSession := strings.TrimSpace(sessionID)
	if trimmedSession == "" {
		return nil, ErrForbiddenSession
	}

	if s.pool == nil {
		s.mu.Lock()
		defer s.mu.Unlock()
		run, ok := s.runsByID[runID]
		if !ok {
			return nil, ErrRunNotFound
		}
		if run.SessionID != trimmedSession {
			return nil, ErrForbiddenSession
		}
		if run.Status != contracts.CadenceStatusReady {
			return nil, ErrRunNotReady
		}
		run.GateVerdict = verdict
		copied := *run
		copied.Turns = append([]contracts.CadenceTurn(nil), run.Turns...)
		return &copied, nil
	}

	existing, err := s.GetSandboxRun(ctx, runID)
	if err != nil {
		return nil, err
	}
	if existing.SessionID != trimmedSession {
		return nil, ErrForbiddenSession
	}
	if existing.Status != contracts.CadenceStatusReady {
		return nil, ErrRunNotReady
	}

	r, err := s.scanSandboxRunRow(
		ctx,
		s.pool.QueryRow(
			ctx,
			`UPDATE sandbox_runs
			 SET gate_verdict = $3
			 WHERE id = $1::uuid AND session_id = $2 AND status = 'ready'
			 RETURNING id::text, session_id, menu_slug, prompt, status, gate_verdict, tokens_in, tokens_out, COALESCE(artifact_html, ''), created_at`,
			runID,
			trimmedSession,
			verdict,
		),
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrRunNotReady
	}
	return r, err
}
