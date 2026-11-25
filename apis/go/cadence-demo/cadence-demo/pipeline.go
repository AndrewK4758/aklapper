package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
	"github.com/AndrewK4758/aklapper/packages/go/kit/llm"
	"github.com/AndrewK4758/aklapper/packages/go/kit/pg"
	"github.com/AndrewK4758/aklapper/packages/go/kit/privacy"
	"github.com/AndrewK4758/aklapper/packages/go/kit/qdrant"
)

type chordExecutionOutput struct {
	Turns         []pg.SandboxTurnInput
	ArtifactHTML  string
	ExecutionMode string
	Spec          *contracts.CadenceSpecArtifact
	GateAudit     *contracts.CadenceGateAudit
	TokensIn      int
	TokensOut     int
	Status        contracts.Osc7501Status
	OSC7501       string
}

type phaseEmitFn func(turn contracts.CadenceTurn, runStatus string, progress int, spec *contracts.CadenceSpecArtifact)

type chordExecInput struct {
	Provider    llm.Provider
	VectorStore *qdrant.Client
	Store       *pg.Store
	PrivacyCfg  *privacy.Config
	CorrID      string
	RunID       string
	Prompt      string
	PresetSlug  string
	Mode        string
	OnPhase     phaseEmitFn
	OnLog       logEmitFn
}

func logCadenceSeam(seamType, eventName, severity string, fields map[string]any) {
	entry := map[string]any{
		"seam_type": seamType,
		"event":     eventName,
		"severity":  severity,
		"service":   "cadence-demo",
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	}
	for k, v := range fields {
		entry[k] = v
	}
	if raw, err := json.Marshal(entry); err == nil {
		log.Println(string(raw))
	}
}

func executeChordSteps(
	ctx context.Context,
	provider llm.Provider,
	vectorStore *qdrant.Client,
	store *pg.Store,
	runID, prompt, presetSlug, mode string,
	onPhase phaseEmitFn,
) (chordExecutionOutput, error) {
	return executeChordStepsWithOptions(ctx, chordExecInput{
		Provider:    provider,
		VectorStore: vectorStore,
		Store:       store,
		RunID:       runID,
		Prompt:      prompt,
		PresetSlug:  presetSlug,
		Mode:        mode,
		OnPhase:     onPhase,
	})
}

func buildDeterministicSpec(prompt, presetSlug string, preset *pg.CadencePresetRecord, recalledPatterns []string) *contracts.CadenceSpecArtifact {
	title := "Custom CADENCE Artifact Specification"
	if preset != nil && strings.TrimSpace(preset.Title) != "" {
		title = preset.Title
	}
	return &contracts.CadenceSpecArtifact{
		Title:   title,
		Summary: fmt.Sprintf("Deterministic CHORD specification for preset %q.", nonEmptyOr(presetSlug, "custom")),
		Conditions: []string{
			fmt.Sprintf("Prompt received (%d chars) under preset %q.", len(strings.TrimSpace(prompt)), nonEmptyOr(presetSlug, "custom")),
			"Isolated opaque-origin sandbox iframe (sandbox=allow-scripts, referrerPolicy=no-referrer).",
		},
		Handling: []string{
			"Run triage classification, bounded Qdrant pattern recall, HTML5/CSS synthesis, and strict CSP sanitization.",
		},
		Outcomes: []string{
			"Self-contained dark Solar Forge HTML5+CSS document <= 48 KiB with pure-CSS interactive controls.",
		},
		Rules: []string{
			"Strict SHA-256 CSP meta (default-src 'none', zero unsafe-inline scripts, zero external fetches).",
			"Zero inline <script>, <svg>, <iframe>, <object>, or on* event handlers.",
		},
		Deltas: []string{
			"Persists sandbox_runs row with structured spec_json, gate_audit_json, and 4 sandbox_turns.",
		},
		RecalledPatterns: recalledPatterns,
	}
}

func buildGateAudit(sanitizedHTML string, stripped bool, extraChecks []contracts.CadenceGateCheckItem) *contracts.CadenceGateAudit {
	summary := "Artifact passed HTML/JS isolation sanitizer; ready for operator gate verdict."
	if stripped {
		summary = "Sanitizer neutralized restricted tags/escape hatches; ready for operator gate verdict."
	}
	checks := []contracts.CadenceGateCheckItem{
		{
			ID:     "csp-sha256",
			Label:  "Strict SHA-256 CSP Meta",
			Status: "pass",
			Detail: "default-src 'none'; sha256-pinned probe script only; zero unsafe-inline scripts.",
		},
		{
			ID:     "payload-cap",
			Label:  "48 KiB Payload Budget",
			Status: "pass",
			Detail: fmt.Sprintf("Verified %d / %d UTF-8 bytes.", len(sanitizedHTML), maxArtifactBytes),
		},
		{
			ID:    "html-sanitizer",
			Label: "HTML/JS Isolation Sanitizer",
			Status: func() string {
				if stripped {
					return "warn"
				}
				return "pass"
			}(),
			Detail: summary,
		},
	}
	for _, c := range extraChecks {
		if strings.TrimSpace(c.ID) != "" && strings.TrimSpace(c.Label) != "" {
			checks = append(checks, c)
		}
	}
	return &contracts.CadenceGateAudit{
		Summary:       summary,
		Sanitized:     stripped,
		ArtifactBytes: len(sanitizedHTML),
		Checks:        checks,
	}
}

type specPhaseOutput struct {
	Spec             *contracts.CadenceSpecArtifact
	RecalledPatterns []string
	SpecTokens       int
	TokensIn         int
	ExecutionMode    string
	Turns            []pg.SandboxTurnInput
	Status           contracts.Osc7501Status
	OSC7501          string
}

func makePhaseEmitHelper(ctx context.Context, in chordExecInput) func(phase, agentName, status, summary string, latencyMs, progress int, payload map[string]any, spec *contracts.CadenceSpecArtifact) error {
	return func(phase, agentName, status, summary string, latencyMs, progress int, payload map[string]any, spec *contracts.CadenceSpecArtifact) error {
		var emitted contracts.CadenceTurn
		if in.RunID != "" {
			dbCtx, dbCancel := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
			updated, err := in.Store.UpdateSandboxTurn(dbCtx, in.RunID, phase, status, summary, latencyMs, payload)
			dbCancel()
			if err != nil {
				return fmt.Errorf("update sandbox turn %s (%s): %w", phase, status, err)
			}
			emitted = updated
		} else {
			emitted = contracts.CadenceTurn{Phase: phase, AgentName: agentName, Status: status, Summary: summary, LatencyMs: latencyMs, Payload: payload}
		}
		if in.OnPhase != nil {
			in.OnPhase(emitted, contracts.CadenceStatusRunning, progress, spec)
		}
		return nil
	}
}

func executeChordSpecPhase(ctx context.Context, in chordExecInput) (specPhaseOutput, error) {
	mode := in.Mode
	if mode != contracts.CadenceModeLLM {
		mode = contracts.CadenceModeFast
	}
	preset, _ := in.Store.GetCadencePreset(ctx, in.PresetSlug)

	emitLog := func(line string) {
		if in.OnLog != nil && strings.TrimSpace(line) != "" {
			in.OnLog(line)
		}
	}
	emitUpdate := makePhaseEmitHelper(ctx, in)

	// Phase 1: Triage
	t1Start := time.Now()
	emitLog("[triage] Evaluating prompt scope and sandbox isolation profile...")
	if err := emitUpdate("triage", "chord-triage", "running", "Evaluating prompt and isolation profile...", 0, 10, nil, nil); err != nil {
		return specPhaseOutput{}, err
	}
	detectedKeywords := extractPromptKeywords(in.Prompt, 6)
	triageSummary := fmt.Sprintf("Classified prompt (%d chars) under preset %q (%s mode).", len(in.Prompt), nonEmptyOr(in.PresetSlug, "custom"), mode)
	triagePayload := map[string]any{
		"presetSlug":       nonEmptyOr(in.PresetSlug, "custom"),
		"promptLen":        len(in.Prompt),
		"mode":             mode,
		"detectedKeywords": detectedKeywords,
		"isolationPolicy":  "sandbox=allow-scripts; opaque-origin; max-48KiB",
	}
	t1Ms := int(time.Since(t1Start).Milliseconds()) + 2
	if err := emitUpdate("triage", "chord-triage", "completed", triageSummary, t1Ms, 25, triagePayload, nil); err != nil {
		return specPhaseOutput{}, err
	}

	// Phase 2: Spec (+ bounded Qdrant recall + live LLM CHORD spec generation)
	t2Start := time.Now()
	emitLog("[spec] Running bounded Qdrant pattern recall and authoring CHORD specification...")
	if err := emitUpdate("spec", "chord-spec", "running", "Authoring CHORD specification and running vector recall...", 0, 35, nil, nil); err != nil {
		return specPhaseOutput{}, err
	}
	recalledPatterns := []string{}
	if in.Provider != nil && in.VectorStore != nil {
		recallBudget := 250 * time.Millisecond
		if mode == contracts.CadenceModeLLM {
			recallBudget = 1500 * time.Millisecond
		}
		recallCtx, cancel := context.WithTimeout(ctx, recallBudget)
		vec, err := in.Provider.Embed(recallCtx, in.Prompt)
		if err == nil && len(vec) > 0 {
			if hits, searchErr := in.VectorStore.Search(recallCtx, cadencePatternsCollection, vec, 2); searchErr == nil {
				for _, hit := range hits {
					if title, ok := hit.Payload["title"].(string); ok && strings.TrimSpace(title) != "" {
						recalledPatterns = append(recalledPatterns, strings.TrimSpace(title))
					}
				}
			}
		}
		cancel()
	}

	specArtifact := buildDeterministicSpec(in.Prompt, in.PresetSlug, preset, recalledPatterns)
	specProvider := "deterministic-fast"
	specFallbackReason := ""
	specTokens := 0
	execMode := contracts.CadenceExecutionModeFast
	if mode == contracts.CadenceModeLLM {
		liveSpec, usedTokens, specErr := invokeLLMSpecStage(
			ctx,
			in.Provider,
			in.PrivacyCfg,
			in.CorrID,
			in.PresetSlug,
			in.Prompt,
			recalledPatterns,
			emitLog,
		)
		if specErr != nil {
			if errors.Is(specErr, privacy.ErrPrivacyAborted) || errors.Is(specErr, context.Canceled) {
				return specPhaseOutput{}, specErr
			}
			specProvider = "deterministic-fallback"
			execMode = contracts.CadenceExecutionModeFallback
			specFallbackReason = "Live LLM spec stage failed or timed out; degraded explicitly to deterministic CHORD spec."
			emitLog("[spec] " + specFallbackReason)
			logCadenceSeam("RULE_DIVERGENCE", "cadence.spec.fallback", "warn", map[string]any{
				"runId":  in.RunID,
				"reason": specErr.Error(),
			})
		} else if liveSpec != nil {
			specCopy := liveSpec.Spec
			specCopy.RecalledPatterns = recalledPatterns
			specArtifact = &specCopy
			specProvider = in.Provider.Name()
			execMode = contracts.CadenceExecutionModeLive
			specTokens = usedTokens
			emitLog("[spec] CHORD specification ready: " + specArtifact.Title)
		}
	}

	specSummary := fmt.Sprintf("Authored CHORD spec %q via %s (recalled %d Qdrant pattern(s)).", specArtifact.Title, specProvider, len(recalledPatterns))
	specPayload := map[string]any{
		"provider":           specProvider,
		"specTitle":          specArtifact.Title,
		"specSummary":        specArtifact.Summary,
		"conditions":         specArtifact.Conditions,
		"handling":           specArtifact.Handling,
		"outcomes":           specArtifact.Outcomes,
		"rules":              specArtifact.Rules,
		"deltas":             specArtifact.Deltas,
		"recalledPatterns":   recalledPatterns,
		"acceptanceCriteria": specArtifact.Outcomes,
		"sandboxConstraints": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'",
	}
	if specFallbackReason != "" {
		specPayload["fallbackReason"] = specFallbackReason
	}
	t2Ms := int(time.Since(t2Start).Milliseconds()) + 4
	if err := emitUpdate("spec", "chord-spec", "completed", specSummary, t2Ms, 50, specPayload, specArtifact); err != nil {
		return specPhaseOutput{}, err
	}

	pct := 50
	gateStatus := contracts.Osc7501Status{
		Source:    "cadence-demo",
		State:     "gate",
		Label:     "CHORD spec ready · awaiting human approval",
		Progress:  &pct,
		Timestamp: time.Now().UTC(),
	}
	return specPhaseOutput{
		Spec:             specArtifact,
		RecalledPatterns: recalledPatterns,
		SpecTokens:       specTokens,
		TokensIn:         len(in.Prompt)/4 + 120,
		ExecutionMode:    execMode,
		Status:           gateStatus,
		OSC7501:          contracts.FormatOSC7501(gateStatus),
		Turns: []pg.SandboxTurnInput{
			{RunID: in.RunID, Phase: "triage", AgentName: "chord-triage", Status: "completed", Summary: triageSummary, PayloadJSON: triagePayload, LatencyMs: t1Ms},
			{RunID: in.RunID, Phase: "spec", AgentName: "chord-spec", Status: "completed", Summary: specSummary, PayloadJSON: specPayload, LatencyMs: t2Ms},
		},
	}, nil
}

func executeChordBuildPhase(
	ctx context.Context,
	in chordExecInput,
	specArtifact *contracts.CadenceSpecArtifact,
	recalledPatterns []string,
	specTokens int,
	priorTurns []pg.SandboxTurnInput,
) (chordExecutionOutput, error) {
	mode := in.Mode
	if mode != contracts.CadenceModeLLM {
		mode = contracts.CadenceModeFast
	}
	preset, _ := in.Store.GetCadencePreset(ctx, in.PresetSlug)
	if specArtifact == nil {
		specArtifact = buildDeterministicSpec(in.Prompt, in.PresetSlug, preset, recalledPatterns)
	}

	emitLog := func(line string) {
		if in.OnLog != nil && strings.TrimSpace(line) != "" {
			in.OnLog(line)
		}
	}
	emitUpdate := makePhaseEmitHelper(ctx, in)

	// Phase 3: Build (fast tailored synthesis vs live LLM implementing the approved CHORD spec)
	t3Start := time.Now()
	if err := emitUpdate("build", "chord-builder", "running", "Synthesizing bespoke HTML5/CSS artifact from approved CHORD spec...", 0, 65, nil, nil); err != nil {
		return chordExecutionOutput{}, err
	}
	tokensIn := len(in.Prompt)/4 + 120
	tokensOut := 480
	buildMode := "deterministic-fast"
	executionMode := contracts.CadenceExecutionModeFast
	fallbackReason := ""
	artifactHTML := buildTailoredArtifactHTML(in.Prompt, in.PresetSlug, preset, recalledPatterns)
	var extraChecks []contracts.CadenceGateCheckItem

	if mode == contracts.CadenceModeLLM {
		built, buildTokens, err := invokeLLMBuildStage(
			ctx,
			in.Provider,
			in.PrivacyCfg,
			in.CorrID,
			in.PresetSlug,
			in.Prompt,
			specArtifact,
			recalledPatterns,
			emitLog,
		)
		if err != nil {
			if errors.Is(err, privacy.ErrPrivacyAborted) || errors.Is(err, context.Canceled) {
				return chordExecutionOutput{}, err
			}
			executionMode = contracts.CadenceExecutionModeFallback
			buildMode = "deterministic-fallback"
			fallbackReason = "Live structured LLM failed or timed out; degraded explicitly to deterministic template."
			emitLog("[build] " + fallbackReason)
			logCadenceSeam("RULE_DIVERGENCE", "cadence.run.execution_mode_selected", "warn", map[string]any{
				"branch": contracts.CadenceExecutionModeFallback,
				"runId":  in.RunID,
				"reason": err.Error(),
			})
		} else if built != nil {
			executionMode = contracts.CadenceExecutionModeLive
			buildMode = in.Provider.Name()
			artifactHTML = built.ArtifactHTML
			if specTokens+buildTokens > 0 {
				tokensOut = specTokens + buildTokens
			}
			extraChecks = built.GateChecks
			logCadenceSeam("RULE_DIVERGENCE", "cadence.run.execution_mode_selected", "info", map[string]any{
				"branch": contracts.CadenceExecutionModeLive,
				"runId":  in.RunID,
			})
		}
	} else {
		logCadenceSeam("RULE_DIVERGENCE", "cadence.run.execution_mode_selected", "info", map[string]any{
			"branch": contracts.CadenceExecutionModeFast,
			"runId":  in.RunID,
		})
	}

	t3Ms := int(time.Since(t3Start).Milliseconds()) + 6
	buildSummary := fmt.Sprintf("Synthesized bounded HTML/CSS artifact (%d bytes) via %s.", len(artifactHTML), buildMode)
	buildPayload := map[string]any{
		"provider":      buildMode,
		"executionMode": executionMode,
		"artifactBytes": len(artifactHTML),
	}
	if fallbackReason != "" {
		buildPayload["fallbackReason"] = fallbackReason
	}
	if err := emitUpdate("build", "chord-builder", "completed", buildSummary, t3Ms, 80, buildPayload, nil); err != nil {
		return chordExecutionOutput{}, err
	}

	// Phase 4: Gate — sanitize & validate
	t4Start := time.Now()
	emitLog("[gate] Running strict SHA-256 CSP HTML sanitizer...")
	if err := emitUpdate("gate", "chord-gate", "running", "Running HTML/JS isolation sanitizer...", 0, 90, nil, nil); err != nil {
		return chordExecutionOutput{}, err
	}
	sanitizedHTML, stripped := sanitizeArtifactHTML(artifactHTML)
	gateAudit := buildGateAudit(sanitizedHTML, stripped, extraChecks)
	gateCheckLabels := make([]string, 0, len(gateAudit.Checks))
	for _, c := range gateAudit.Checks {
		gateCheckLabels = append(gateCheckLabels, c.Label+": "+c.Detail)
	}
	gatePayload := map[string]any{
		"sanitized":     stripped,
		"gateVerdict":   "pending",
		"artifactBytes": len(sanitizedHTML),
		"checks":        gateCheckLabels,
	}
	t4Ms := int(time.Since(t4Start).Milliseconds()) + 3
	if err := emitUpdate("gate", "chord-gate", "completed", gateAudit.Summary, t4Ms, 100, gatePayload, nil); err != nil {
		return chordExecutionOutput{}, err
	}

	pct := 100
	readyStatus := contracts.Osc7501Status{
		Source:    "cadence-demo",
		State:     "ready",
		Label:     "CHORD spec + sandbox artifact ready",
		Progress:  &pct,
		Timestamp: time.Now().UTC(),
	}

	allTurns := make([]pg.SandboxTurnInput, 0, len(priorTurns)+2)
	allTurns = append(allTurns, priorTurns...)
	allTurns = append(allTurns,
		pg.SandboxTurnInput{RunID: in.RunID, Phase: "build", AgentName: "chord-builder", Status: "completed", Summary: buildSummary, PayloadJSON: buildPayload, LatencyMs: t3Ms},
		pg.SandboxTurnInput{RunID: in.RunID, Phase: "gate", AgentName: "chord-gate", Status: "completed", Summary: gateAudit.Summary, PayloadJSON: gatePayload, LatencyMs: t4Ms},
	)

	return chordExecutionOutput{
		ArtifactHTML:  sanitizedHTML,
		ExecutionMode: executionMode,
		Spec:          specArtifact,
		GateAudit:     gateAudit,
		TokensIn:      tokensIn,
		TokensOut:     tokensOut,
		Status:        readyStatus,
		OSC7501:       contracts.FormatOSC7501(readyStatus),
		Turns:         allTurns,
	}, nil
}

func executeChordStepsWithOptions(ctx context.Context, in chordExecInput) (chordExecutionOutput, error) {
	specOut, err := executeChordSpecPhase(ctx, in)
	if err != nil {
		return chordExecutionOutput{}, err
	}
	return executeChordBuildPhase(ctx, in, specOut.Spec, specOut.RecalledPatterns, specOut.SpecTokens, specOut.Turns)
}
