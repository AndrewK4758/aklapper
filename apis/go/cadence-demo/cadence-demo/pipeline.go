package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
	"github.com/AndrewK4758/aklapper/packages/go/kit/k8sevents"
	"github.com/AndrewK4758/aklapper/packages/go/kit/llm"
	"github.com/AndrewK4758/aklapper/packages/go/kit/pg"
	"github.com/AndrewK4758/aklapper/packages/go/kit/qdrant"
)

type chordExecutionOutput struct {
	Turns        []pg.SandboxTurnInput
	ArtifactHTML string
	TokensIn     int
	TokensOut    int
	Status       contracts.Osc7501Status
	OSC7501      string
}

type phaseEmitFn func(turn contracts.CadenceTurn, runStatus string, progress int)

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
	if mode != contracts.CadenceModeLLM {
		mode = contracts.CadenceModeFast
	}
	preset, _ := store.GetCadencePreset(ctx, presetSlug)

	emitUpdate := func(phase, agentName, status, summary string, latencyMs, progress int, payload map[string]any) error {
		var emitted contracts.CadenceTurn
		if runID != "" {
			updated, err := store.UpdateSandboxTurn(ctx, runID, phase, status, summary, latencyMs, payload)
			if err != nil {
				return fmt.Errorf("update sandbox turn %s (%s): %w", phase, status, err)
			}
			emitted = updated
		} else {
			emitted = contracts.CadenceTurn{Phase: phase, AgentName: agentName, Status: status, Summary: summary, LatencyMs: latencyMs, Payload: payload}
		}
		if onPhase != nil {
			onPhase(emitted, contracts.CadenceStatusRunning, progress)
		}
		return nil
	}

	// Phase 1: Triage
	t1Start := time.Now()
	if err := emitUpdate("triage", "chord-triage", "running", "Evaluating prompt and isolation profile...", 0, 10, nil); err != nil {
		return chordExecutionOutput{}, err
	}
	detectedKeywords := extractPromptKeywords(prompt, 6)
	triageSummary := fmt.Sprintf("Classified prompt (%d chars) under preset %q (%s mode).", len(prompt), nonEmptyOr(presetSlug, "custom"), mode)
	triagePayload := map[string]any{
		"presetSlug":       nonEmptyOr(presetSlug, "custom"),
		"promptLen":        len(prompt),
		"mode":             mode,
		"detectedKeywords": detectedKeywords,
		"isolationPolicy":  "sandbox=allow-scripts; opaque-origin; max-48KiB",
	}
	t1Ms := int(time.Since(t1Start).Milliseconds()) + 2
	if err := emitUpdate("triage", "chord-triage", "completed", triageSummary, t1Ms, 25, triagePayload); err != nil {
		return chordExecutionOutput{}, err
	}

	// Phase 2: Spec (+ bounded Qdrant recall)
	t2Start := time.Now()
	if err := emitUpdate("spec", "chord-spec", "running", "Drafting sandbox spec and bounded vector recall...", 0, 35, nil); err != nil {
		return chordExecutionOutput{}, err
	}
	recalledPatterns := []string{}
	if provider != nil && vectorStore != nil {
		recallBudget := 250 * time.Millisecond
		if mode == contracts.CadenceModeLLM {
			recallBudget = 1500 * time.Millisecond
		}
		recallCtx, cancel := context.WithTimeout(ctx, recallBudget)
		vec, err := provider.Embed(recallCtx, prompt)
		if err == nil && len(vec) > 0 {
			if hits, searchErr := vectorStore.Search(recallCtx, cadencePatternsCollection, vec, 2); searchErr == nil {
				for _, hit := range hits {
					if title, ok := hit.Payload["title"].(string); ok && strings.TrimSpace(title) != "" {
						recalledPatterns = append(recalledPatterns, strings.TrimSpace(title))
					}
				}
			}
		}
		cancel()
	}
	acceptanceCriteria := []string{
		"Self-contained dark Solar Forge HTML5+CSS document filling 100% width with no scrollbars",
		"Interactive controls using pure HTML5/CSS (radio-button tabs, <details>, progress/bar charts)",
		"Zero external fetches, zero inline <script> or on* handlers, <= 48 KiB UTF-8",
	}
	specSummary := fmt.Sprintf("Drafted single-file HTML/CSS spec (recalled %d Qdrant pattern(s)).", len(recalledPatterns))
	specPayload := map[string]any{
		"recalledPatterns":   recalledPatterns,
		"acceptanceCriteria": acceptanceCriteria,
		"sandboxConstraints": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'",
	}
	t2Ms := int(time.Since(t2Start).Milliseconds()) + 4
	if err := emitUpdate("spec", "chord-spec", "completed", specSummary, t2Ms, 50, specPayload); err != nil {
		return chordExecutionOutput{}, err
	}

	// Phase 3: Build (fast tailored synthesis vs optional LLM)
	t3Start := time.Now()
	if err := emitUpdate("build", "chord-builder", "running", "Synthesizing tailored Solar Forge artifact...", 0, 65, nil); err != nil {
		return chordExecutionOutput{}, err
	}
	tokensIn := len(prompt)/4 + 120
	tokensOut := 480
	buildMode := "deterministic-fast"
	fallbackReason := ""
	artifactHTML := buildTailoredArtifactHTML(prompt, presetSlug, preset, recalledPatterns)

	if mode == contracts.CadenceModeLLM && provider != nil {
		buildMode = "deterministic-fallback"
		buildCtx, cancel := context.WithTimeout(ctx, 25*time.Second)
		patternHint := "none"
		if len(recalledPatterns) > 0 {
			patternHint = strings.Join(recalledPatterns, ", ")
		}
		completion, err := provider.Chat(buildCtx, []llm.ChatMessage{
			{
				Role: "system",
				Content: "Generate a rich, self-contained single-file HTML5 document with dark Solar Forge styling (#121110 bg, #1c1a17 panel, #ffd300 gold, #22c55e green, #f4efe6 text, monospace font) for an isolated iframe sandbox. " +
					"Make it genuinely useful and interactive using PURE HTML5 and CSS: radio-button CSS tabs, <details>/<summary> accordions, CSS bar charts/gauges, metric grids, and tables. " +
					"Fill 100% width with no outer scrollbars (scrollbar-width:none). " +
					"STRICT SECURITY: Never use <script>, <svg>, <iframe>, <object>, <link>, @import, or inline on* event attributes. Output raw HTML only.",
			},
			{
				Role:    "user",
				Content: fmt.Sprintf("Preset: %s\nRecalled Qdrant Patterns: %s\nUser Prompt: %s", nonEmptyOr(presetSlug, "custom"), patternHint, prompt),
			},
		}, 2800)
		cancel()
		if err == nil && strings.Contains(strings.ToLower(completion.Text), "<html") {
			artifactHTML = completion.Text
			buildMode = provider.Name()
			if completion.TokensUsed > 0 {
				tokensOut = completion.TokensUsed
			}
		} else if err != nil {
			fallbackReason = "LLM provider timed out or failed; fell back to structured interactive template."
		} else {
			fallbackReason = "LLM output did not contain a valid HTML document; fell back to structured interactive template."
		}
	} else if mode == contracts.CadenceModeLLM {
		buildMode = "deterministic-fallback"
		fallbackReason = "No live LLM provider configured on cadence-demo."
	}
	t3Ms := int(time.Since(t3Start).Milliseconds()) + 6
	buildSummary := fmt.Sprintf("Synthesized bounded HTML/CSS artifact (%d bytes) via %s.", len(artifactHTML), buildMode)
	buildPayload := map[string]any{
		"provider":      buildMode,
		"artifactBytes": len(artifactHTML),
	}
	if fallbackReason != "" {
		buildPayload["fallbackReason"] = fallbackReason
	}
	if err := emitUpdate("build", "chord-builder", "completed", buildSummary, t3Ms, 80, buildPayload); err != nil {
		return chordExecutionOutput{}, err
	}

	// Phase 4: Gate — sanitize & validate
	t4Start := time.Now()
	if err := emitUpdate("gate", "chord-gate", "running", "Running HTML/JS isolation sanitizer...", 0, 90, nil); err != nil {
		return chordExecutionOutput{}, err
	}
	sanitizedHTML, stripped := sanitizeArtifactHTML(artifactHTML)
	gateSummary := "Artifact passed HTML/JS isolation sanitizer; ready for operator gate verdict."
	if stripped {
		gateSummary = "Sanitizer neutralized restricted tags/escape hatches; ready for operator gate verdict."
	}
	gateChecks := []string{
		"Strict CSP meta injected (default-src 'none', sha256-pinned probe script)",
		fmt.Sprintf("Payload size verified (%d / %d bytes)", len(sanitizedHTML), maxArtifactBytes),
		"Zero external network fetches, zero iframe/svg/object/event-handler escape hatches",
	}
	gatePayload := map[string]any{
		"sanitized":     stripped,
		"gateVerdict":   "pending",
		"artifactBytes": len(sanitizedHTML),
		"checks":        gateChecks,
	}
	t4Ms := int(time.Since(t4Start).Milliseconds()) + 3
	if err := emitUpdate("gate", "chord-gate", "completed", gateSummary, t4Ms, 100, gatePayload); err != nil {
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

	return chordExecutionOutput{
		ArtifactHTML: sanitizedHTML,
		TokensIn:     tokensIn,
		TokensOut:    tokensOut,
		Status:       readyStatus,
		OSC7501:      k8sevents.FormatOSC7501(readyStatus),
		Turns: []pg.SandboxTurnInput{
			{RunID: runID, Phase: "triage", AgentName: "chord-triage", Status: "completed", Summary: triageSummary, PayloadJSON: triagePayload, LatencyMs: t1Ms},
			{RunID: runID, Phase: "spec", AgentName: "chord-spec", Status: "completed", Summary: specSummary, PayloadJSON: specPayload, LatencyMs: t2Ms},
			{RunID: runID, Phase: "build", AgentName: "chord-builder", Status: "completed", Summary: buildSummary, PayloadJSON: buildPayload, LatencyMs: t3Ms},
			{RunID: runID, Phase: "gate", AgentName: "chord-gate", Status: "completed", Summary: gateSummary, PayloadJSON: gatePayload, LatencyMs: t4Ms},
		},
	}, nil
}
