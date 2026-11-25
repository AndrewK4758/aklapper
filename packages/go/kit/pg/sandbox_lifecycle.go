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
	ErrForbiddenSession       = errors.New("sandbox run belongs to a different session")
	ErrRunNotReady            = errors.New("sandbox run is not ready for gate verdict")
	ErrRunNotAwaitingApproval = errors.New("sandbox run is not awaiting spec approval")
)

type CadencePresetRecord = contracts.CadencePreset

type PendingSandboxRunInput struct {
	SessionID           string
	IPHash              string
	PresetSlug          string
	Prompt              string
	Mode                string
	PromptHash          string
	RequireSpecApproval bool
}

type PauseSpecApprovalInput struct {
	RunID         string
	TokensIn      int
	TokensOut     int
	ExecutionMode string
	SpecJSON      *contracts.CadenceSpecArtifact
	PromptHash    string
}

type CompleteSandboxRunInput struct {
	RunID         string
	TokensIn      int
	TokensOut     int
	ArtifactHTML  string
	ExecutionMode string
	SpecJSON      *contracts.CadenceSpecArtifact
	GateAuditJSON *contracts.CadenceGateAudit
	PromptHash    string
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
	r, err := scanSandboxRunFields(row)
	if err != nil {
		return nil, err
	}
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
			`SELECT `+sandboxRunSelectColumns+`
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
			 WHERE id = $1::uuid AND session_id = $2 AND status = 'pending' AND is_golden = false
			 RETURNING `+sandboxRunSelectColumns,
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
	return s.CompleteSandboxRunWithArtifacts(ctx, CompleteSandboxRunInput{
		RunID:        runID,
		TokensIn:     tokensIn,
		TokensOut:    tokensOut,
		ArtifactHTML: artifactHTML,
	})
}

func (s *Store) CompleteSandboxRunWithArtifacts(ctx context.Context, input CompleteSandboxRunInput) (*SandboxRun, error) {
	if s == nil {
		return nil, ErrRunNotFound
	}
	if s.pool == nil {
		s.mu.Lock()
		defer s.mu.Unlock()
		run, ok := s.runsByID[input.RunID]
		if !ok {
			return nil, ErrRunNotFound
		}
		if run.IsGolden {
			return nil, ErrGoldenRunImmutable
		}
		run.Status = contracts.CadenceStatusReady
		run.TokensIn = input.TokensIn
		run.TokensOut = input.TokensOut
		run.ArtifactHTML = input.ArtifactHTML
		if strings.TrimSpace(input.ExecutionMode) != "" {
			run.ExecutionMode = strings.TrimSpace(input.ExecutionMode)
		}
		if input.SpecJSON != nil {
			run.SpecJSON = input.SpecJSON
		}
		if input.GateAuditJSON != nil {
			run.GateAuditJSON = input.GateAuditJSON
		}
		if strings.TrimSpace(input.PromptHash) != "" {
			run.PromptHash = strings.TrimSpace(input.PromptHash)
		}
		copied := *run
		copied.Turns = append([]contracts.CadenceTurn(nil), run.Turns...)
		return &copied, nil
	}

	if !isValidUUIDString(input.RunID) {
		return nil, ErrRunNotFound
	}

	var execModeParam any
	if strings.TrimSpace(input.ExecutionMode) != "" {
		execModeParam = strings.TrimSpace(input.ExecutionMode)
	}
	var promptHashParam any
	if strings.TrimSpace(input.PromptHash) != "" {
		promptHashParam = strings.TrimSpace(input.PromptHash)
	}

	r, err := s.scanSandboxRunRow(
		ctx,
		s.pool.QueryRow(
			ctx,
			`UPDATE sandbox_runs
			 SET status = 'ready',
			     tokens_in = $2,
			     tokens_out = $3,
			     artifact_html = $4,
			     execution_mode = COALESCE($5, execution_mode),
			     spec_json = COALESCE($6::jsonb, spec_json),
			     gate_audit_json = COALESCE($7::jsonb, gate_audit_json),
			     prompt_hash = COALESCE($8, prompt_hash)
			 WHERE id = $1::uuid AND is_golden = false
			 RETURNING `+sandboxRunSelectColumns,
			input.RunID,
			input.TokensIn,
			input.TokensOut,
			input.ArtifactHTML,
			execModeParam,
			marshalNullableJSON(input.SpecJSON),
			marshalNullableJSON(input.GateAuditJSON),
			promptHashParam,
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
		if run.IsGolden {
			return nil, ErrGoldenRunImmutable
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
	if existing.IsGolden {
		return nil, ErrGoldenRunImmutable
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
			 WHERE id = $1::uuid AND session_id = $2 AND status = 'ready' AND is_golden = false
			 RETURNING `+sandboxRunSelectColumns,
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

func ExtractRequireSpecApprovalFromTurns(turns []contracts.CadenceTurn) bool {
	for _, t := range turns {
		if t.Phase == "triage" && t.Payload != nil {
			if raw, ok := t.Payload["requireSpecApproval"].(bool); ok {
				return raw
			}
		}
	}
	return false
}

func (s *Store) PauseSandboxRunForSpecApproval(ctx context.Context, input PauseSpecApprovalInput) (*SandboxRun, error) {
	if s == nil {
		return nil, ErrRunNotFound
	}
	if s.pool == nil {
		s.mu.Lock()
		defer s.mu.Unlock()
		run, ok := s.runsByID[input.RunID]
		if !ok {
			return nil, ErrRunNotFound
		}
		if run.IsGolden {
			return nil, ErrGoldenRunImmutable
		}
		run.Status = contracts.CadenceStatusAwaitingApproval
		run.TokensIn = input.TokensIn
		run.TokensOut = input.TokensOut
		if strings.TrimSpace(input.ExecutionMode) != "" {
			run.ExecutionMode = strings.TrimSpace(input.ExecutionMode)
		}
		if input.SpecJSON != nil {
			run.SpecJSON = input.SpecJSON
		}
		if strings.TrimSpace(input.PromptHash) != "" {
			run.PromptHash = strings.TrimSpace(input.PromptHash)
		}
		copied := *run
		copied.Turns = append([]contracts.CadenceTurn(nil), run.Turns...)
		return &copied, nil
	}

	if !isValidUUIDString(input.RunID) {
		return nil, ErrRunNotFound
	}

	var execModeParam any
	if strings.TrimSpace(input.ExecutionMode) != "" {
		execModeParam = strings.TrimSpace(input.ExecutionMode)
	}
	var promptHashParam any
	if strings.TrimSpace(input.PromptHash) != "" {
		promptHashParam = strings.TrimSpace(input.PromptHash)
	}

	r, err := s.scanSandboxRunRow(
		ctx,
		s.pool.QueryRow(
			ctx,
			`UPDATE sandbox_runs
			 SET status = 'awaiting_approval',
			     tokens_in = $2,
			     tokens_out = $3,
			     execution_mode = COALESCE($4, execution_mode),
			     spec_json = COALESCE($5::jsonb, spec_json),
			     prompt_hash = COALESCE($6, prompt_hash)
			 WHERE id = $1::uuid AND is_golden = false
			 RETURNING `+sandboxRunSelectColumns,
			input.RunID,
			input.TokensIn,
			input.TokensOut,
			execModeParam,
			marshalNullableJSON(input.SpecJSON),
			promptHashParam,
		),
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrRunNotFound
	}
	return r, err
}

func (s *Store) ApproveSandboxRunSpecForSession(ctx context.Context, runID, sessionID string) (*SandboxRun, error) {
	if s == nil {
		return nil, ErrRunNotFound
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
		if run.IsGolden {
			return nil, ErrGoldenRunImmutable
		}
		if run.SessionID != trimmedSession {
			return nil, ErrForbiddenSession
		}
		if run.Status != contracts.CadenceStatusAwaitingApproval {
			return nil, ErrRunNotAwaitingApproval
		}
		run.Status = contracts.CadenceStatusBuildQueued
		copied := *run
		copied.Turns = append([]contracts.CadenceTurn(nil), run.Turns...)
		return &copied, nil
	}

	existing, err := s.GetSandboxRun(ctx, runID)
	if err != nil {
		return nil, err
	}
	if existing.IsGolden {
		return nil, ErrGoldenRunImmutable
	}
	if existing.SessionID != trimmedSession {
		return nil, ErrForbiddenSession
	}
	if existing.Status != contracts.CadenceStatusAwaitingApproval {
		return nil, ErrRunNotAwaitingApproval
	}

	r, err := s.scanSandboxRunRow(
		ctx,
		s.pool.QueryRow(
			ctx,
			`UPDATE sandbox_runs
			 SET status = 'build_queued'
			 WHERE id = $1::uuid AND session_id = $2 AND status = 'awaiting_approval' AND is_golden = false
			 RETURNING `+sandboxRunSelectColumns,
			runID,
			trimmedSession,
		),
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrRunNotAwaitingApproval
	}
	return r, err
}

func (s *Store) ClaimBuildQueuedSandboxRun(ctx context.Context, runID, sessionID string) (*SandboxRun, bool, error) {
	if s == nil {
		return nil, false, nil
	}
	if s.pool == nil {
		s.mu.Lock()
		defer s.mu.Unlock()
		run, ok := s.runsByID[runID]
		if !ok || run.SessionID != sessionID || run.Status != contracts.CadenceStatusBuildQueued {
			return nil, false, nil
		}
		run.Status = contracts.CadenceStatusBuilding
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
			 SET status = 'building'
			 WHERE id = $1::uuid AND session_id = $2 AND status = 'build_queued' AND is_golden = false
			 RETURNING `+sandboxRunSelectColumns,
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
