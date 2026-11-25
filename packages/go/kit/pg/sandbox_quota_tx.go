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

func ExtractPresetSlugFromTurns(turns []contracts.CadenceTurn, fallbackMenuSlug string) string {
	for _, turn := range turns {
		if turn.Phase == "triage" && turn.Payload != nil {
			if raw, ok := turn.Payload["presetSlug"].(string); ok && strings.TrimSpace(raw) != "" {
				return strings.TrimSpace(raw)
			}
		}
	}
	trimmed := strings.TrimSpace(fallbackMenuSlug)
	if trimmed != "" && trimmed != "cadence" {
		return trimmed
	}
	return ""
}

func ExtractModeFromTurns(turns []contracts.CadenceTurn) string {
	for _, turn := range turns {
		if turn.Phase == "triage" && turn.Payload != nil {
			if raw, ok := turn.Payload["mode"].(string); ok {
				if raw == contracts.CadenceModeFast || raw == contracts.CadenceModeLLM {
					return raw
				}
			}
		}
	}
	return ""
}

func SandboxRunToContractResult(run *SandboxRun, quota *contracts.QuotaStatus, status *contracts.Osc7501Status, osc7501 string) contracts.CadenceRunResult {
	if run == nil {
		return contracts.CadenceRunResult{Turns: []contracts.CadenceTurn{}}
	}
	turns := run.Turns
	if turns == nil {
		turns = []contracts.CadenceTurn{}
	}
	return contracts.CadenceRunResult{
		RunID:         run.RunID,
		Prompt:        run.Prompt,
		PresetSlug:    ExtractPresetSlugFromTurns(turns, run.MenuSlug),
		RunStatus:     run.Status,
		Mode:          ExtractModeFromTurns(turns),
		ExecutionMode: run.ExecutionMode,
		IsGolden:      run.IsGolden,
		Spec:          run.SpecJSON,
		GateAudit:     run.GateAuditJSON,
		Status:        status,
		OSC7501:       osc7501,
		GateVerdict:   run.GateVerdict,
		Turns:         turns,
		ArtifactHTML:  run.ArtifactHTML,
		TokensIn:      run.TokensIn,
		TokensOut:     run.TokensOut,
		Quota:         quota,
		CreatedAt:     run.CreatedAt,
	}
}

func (s *Store) CreatePendingSandboxRunWithQuota(
	ctx context.Context,
	role, sessionID string,
	turnsDelta, tokensDelta int,
	input PendingSandboxRunInput,
) (*SandboxRun, contracts.QuotaStatus, bool, error) {
	role = normalizeRole(role)
	sessionID = normalizeSessionID(sessionID)
	if turnsDelta <= 0 {
		turnsDelta = 1
	}
	if tokensDelta < 0 {
		tokensDelta = 0
	}
	mode := strings.TrimSpace(input.Mode)
	if mode != contracts.CadenceModeLLM {
		mode = contracts.CadenceModeFast
	}
	presetSlug := strings.TrimSpace(input.PresetSlug)
	if presetSlug == "" {
		presetSlug = "custom"
	}
	ipHash := strings.TrimSpace(input.IPHash)
	if ipHash == "" {
		ipHash = "portal-proxy"
	}

	today := time.Now().UTC().Format("2006-01-02")
	sessionKey := "session:" + sessionID
	globalKey := "global:" + today

	if s == nil || s.pool == nil {
		if s == nil {
			s = NewMemoryStore()
		}
		s.mu.Lock()
		defer s.mu.Unlock()

		policy, ok := s.policies[role]
		if !ok {
			policy = defaultPolicies()[role]
		}
		sb := s.buckets[sessionKey]
		if sb == nil {
			sb = &memBucket{windowDay: today}
			s.buckets[sessionKey] = sb
		}
		gb := s.buckets[globalKey]
		if gb == nil || gb.windowDay != today {
			gb = &memBucket{windowDay: today}
			s.buckets[globalKey] = gb
		}

		maxSessionTokens := policy.MaxTokensPerRun * policy.MaxTurnsPerSession
		quotaExceeded := sb.turnsUsed+turnsDelta > policy.MaxTurnsPerSession ||
			tokensDelta > policy.MaxTokensPerRun ||
			gb.tokensUsed+tokensDelta > policy.MaxDailyGlobalTokens
		if quotaExceeded && !s.isDevUnlimitedEnabled() {
			return nil, contracts.QuotaStatus{
				Role:       role,
				TurnsUsed:  sb.turnsUsed,
				MaxTurns:   policy.MaxTurnsPerSession,
				TokensUsed: sb.tokensUsed,
				MaxTokens:  maxSessionTokens,
			}, false, nil
		}
		if quotaExceeded {
			logDevUnlimitedBypass(role, sessionID, "cadence-pending", "")
		}

		sb.turnsUsed += turnsDelta
		sb.tokensUsed += tokensDelta
		gb.turnsUsed += turnsDelta
		gb.tokensUsed += tokensDelta

		runID := newUUIDv4()
		nowStr := time.Now().UTC().Format(time.RFC3339)
		execMode := contracts.CadenceExecutionModeFast
		if mode == contracts.CadenceModeLLM {
			execMode = contracts.CadenceExecutionModeLive
		}
		turns := make([]contracts.CadenceTurn, 0, len(chordPhaseSpecs))
		for _, spec := range chordPhaseSpecs {
			s.turnSeq++
			payload := map[string]any{"summary": "Queued"}
			if spec.Phase == "triage" {
				payload = map[string]any{
					"summary":        "Queued in CHORD pipeline",
					"presetSlug":     presetSlug,
					"mode":           mode,
					"reservedTokens": tokensDelta,
				}
			}
			turns = append(turns, contracts.CadenceTurn{
				ID:        s.turnSeq,
				Phase:     spec.Phase,
				AgentName: spec.AgentName,
				Status:    contracts.CadenceStatusPending,
				Summary:   payload["summary"].(string),
				LatencyMs: 0,
				Payload:   payload,
				CreatedAt: nowStr,
			})
		}

		run := &SandboxRun{
			RunID:         runID,
			SessionID:     sessionID,
			MenuSlug:      presetSlug,
			Prompt:        input.Prompt,
			Status:        contracts.CadenceStatusPending,
			GateVerdict:   contracts.CadenceStatusPending,
			PromptHash:    strings.TrimSpace(input.PromptHash),
			ExecutionMode: execMode,
			Turns:         turns,
			CreatedAt:     nowStr,
		}
		s.runs = append([]*SandboxRun{run}, s.runs...)
		s.runsByID[runID] = run

		copied := *run
		copied.Turns = append([]contracts.CadenceTurn(nil), turns...)
		return &copied, contracts.QuotaStatus{
			Role:       role,
			TurnsUsed:  sb.turnsUsed,
			MaxTurns:   policy.MaxTurnsPerSession,
			TokensUsed: sb.tokensUsed,
			MaxTokens:  maxSessionTokens,
		}, true, nil
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, contracts.QuotaStatus{}, false, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	policy := s.loadPolicy(ctx, tx, role)
	maxSessionTokens := policy.MaxTokensPerRun * policy.MaxTurnsPerSession

	for _, key := range []string{sessionKey, globalKey} {
		if _, err := tx.Exec(
			ctx,
			`INSERT INTO rate_limit_buckets (scope_key, window_start, turns_used, tokens_used)
			 VALUES ($1, NOW(), 0, 0)
			 ON CONFLICT (scope_key) DO NOTHING`,
			key,
		); err != nil {
			return nil, contracts.QuotaStatus{}, false, err
		}
	}

	var sessionTurns, sessionTokens int
	if err := tx.QueryRow(
		ctx,
		`SELECT turns_used, tokens_used FROM rate_limit_buckets WHERE scope_key = $1 FOR UPDATE`,
		sessionKey,
	).Scan(&sessionTurns, &sessionTokens); err != nil {
		return nil, contracts.QuotaStatus{}, false, err
	}

	var globalTokens int
	if err := tx.QueryRow(
		ctx,
		`SELECT tokens_used FROM rate_limit_buckets WHERE scope_key = $1 FOR UPDATE`,
		globalKey,
	).Scan(&globalTokens); err != nil {
		return nil, contracts.QuotaStatus{}, false, err
	}

	quotaExceeded := sessionTurns+turnsDelta > policy.MaxTurnsPerSession ||
		tokensDelta > policy.MaxTokensPerRun ||
		globalTokens+tokensDelta > policy.MaxDailyGlobalTokens
	if quotaExceeded && !s.isDevUnlimitedEnabled() {
		return nil, contracts.QuotaStatus{
			Role:       role,
			TurnsUsed:  sessionTurns,
			MaxTurns:   policy.MaxTurnsPerSession,
			TokensUsed: sessionTokens,
			MaxTokens:  maxSessionTokens,
		}, false, nil
	}
	if quotaExceeded {
		logDevUnlimitedBypass(role, sessionID, "cadence-pending", "")
	}

	if _, err := tx.Exec(
		ctx,
		`UPDATE rate_limit_buckets
		 SET turns_used = turns_used + $2, tokens_used = tokens_used + $3
		 WHERE scope_key = $1`,
		sessionKey,
		turnsDelta,
		tokensDelta,
	); err != nil {
		return nil, contracts.QuotaStatus{}, false, err
	}
	if _, err := tx.Exec(
		ctx,
		`UPDATE rate_limit_buckets
		 SET turns_used = turns_used + $2, tokens_used = tokens_used + $3
		 WHERE scope_key = $1`,
		globalKey,
		turnsDelta,
		tokensDelta,
	); err != nil {
		return nil, contracts.QuotaStatus{}, false, err
	}

	execMode := contracts.CadenceExecutionModeFast
	if mode == contracts.CadenceModeLLM {
		execMode = contracts.CadenceExecutionModeLive
	}
	var promptHashParam any
	if strings.TrimSpace(input.PromptHash) != "" {
		promptHashParam = strings.TrimSpace(input.PromptHash)
	}

	run, err := scanSandboxRunFields(
		tx.QueryRow(
			ctx,
			`INSERT INTO sandbox_runs
			 (session_id, ip_hash, menu_slug, prompt, status, gate_verdict, tokens_in, tokens_out,
			  artifact_html, is_golden, prompt_hash, execution_mode)
			 VALUES ($1, $2, $3, $4, 'pending', 'pending', 0, 0, '', false, $5, $6)
			 RETURNING `+sandboxRunSelectColumns,
			sessionID,
			ipHash,
			presetSlug,
			input.Prompt,
			promptHashParam,
			execMode,
		),
	)
	if err != nil {
		return nil, contracts.QuotaStatus{}, false, err
	}

	run.Turns = make([]contracts.CadenceTurn, 0, len(chordPhaseSpecs))
	for _, spec := range chordPhaseSpecs {
		payload := map[string]any{"summary": "Queued"}
		if spec.Phase == "triage" {
			payload = map[string]any{
				"summary":        "Queued in CHORD pipeline",
				"presetSlug":     presetSlug,
				"mode":           mode,
				"reservedTokens": tokensDelta,
			}
		}
		rawJSON, err := json.Marshal(payload)
		if err != nil {
			return nil, contracts.QuotaStatus{}, false, err
		}
		var t contracts.CadenceTurn
		var tCreated time.Time
		if err := tx.QueryRow(
			ctx,
			`INSERT INTO sandbox_turns (run_id, phase, agent_name, status, payload_json, latency_ms)
			 VALUES ($1::uuid, $2, $3, 'pending', $4::jsonb, 0)
			 RETURNING id, created_at`,
			run.RunID,
			spec.Phase,
			spec.AgentName,
			string(rawJSON),
		).Scan(&t.ID, &tCreated); err != nil {
			return nil, contracts.QuotaStatus{}, false, err
		}
		t.Phase = spec.Phase
		t.AgentName = spec.AgentName
		t.Status = contracts.CadenceStatusPending
		t.Summary = payload["summary"].(string)
		t.Payload = payload
		t.CreatedAt = tCreated.UTC().Format(time.RFC3339)
		run.Turns = append(run.Turns, t)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, contracts.QuotaStatus{}, false, err
	}

	return &run, contracts.QuotaStatus{
		Role:       role,
		TurnsUsed:  sessionTurns + turnsDelta,
		MaxTurns:   policy.MaxTurnsPerSession,
		TokensUsed: sessionTokens + tokensDelta,
		MaxTokens:  maxSessionTokens,
	}, true, nil
}

func (s *Store) GetCadencePreset(ctx context.Context, slug string) (*CadencePresetRecord, error) {
	trimmed := strings.TrimSpace(slug)
	if trimmed == "" || trimmed == "custom" || trimmed == "__custom__" || s == nil || s.pool == nil {
		return nil, nil
	}

	var preset CadencePresetRecord
	err := s.pool.QueryRow(
		ctx,
		`SELECT slug, title, starter_prompt, expected_kind, starter_artifact_html, sort_order
		 FROM cadence_presets
		 WHERE slug = $1`,
		trimmed,
	).Scan(
		&preset.Slug,
		&preset.Title,
		&preset.StarterPrompt,
		&preset.ExpectedKind,
		&preset.StarterArtifactHTML,
		&preset.SortOrder,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &preset, nil
}
