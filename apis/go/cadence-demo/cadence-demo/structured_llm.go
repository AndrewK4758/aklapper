package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
	"github.com/AndrewK4758/aklapper/packages/go/kit/llm"
	"github.com/AndrewK4758/aklapper/packages/go/kit/privacy"
)

const (
	maxStructuredLLMBytes = 96 * 1024
	logProgressInterval   = 1200 * time.Millisecond
)

var (
	errStructuredBufferCap = errors.New("structured llm output exceeded 96 KiB buffer cap")
	specTemperature        = 0.8
	buildTemperature       = 0.85
)

type structuredSpecOutput struct {
	Triage string                        `json:"triage"`
	Spec   contracts.CadenceSpecArtifact `json:"spec"`
}

type structuredBuildOutput struct {
	GateChecks   []contracts.CadenceGateCheckItem `json:"gateChecks"`
	ArtifactHTML string                           `json:"artifactHtml"`
}

func randomVariationNonce() string {
	var raw [6]byte
	if _, err := rand.Read(raw[:]); err != nil {
		return fmt.Sprintf("%x", time.Now().UnixNano())
	}
	return hex.EncodeToString(raw[:])
}

func structuredSpecSchema() *llm.JSONSchema {
	strArr := func(desc string) *llm.JSONSchema {
		return &llm.JSONSchema{
			Type:        "array",
			Description: desc,
			Items:       &llm.JSONSchema{Type: "string"},
		}
	}
	return &llm.JSONSchema{
		Name: "cadence_chord_spec",
		Type: "object",
		Properties: map[string]*llm.JSONSchema{
			"triage": {Type: "string", Description: "Brief triage classification summary"},
			"spec": {
				Type: "object",
				Properties: map[string]*llm.JSONSchema{
					"title":      {Type: "string", Description: "Specific title for this tailored artifact"},
					"summary":    {Type: "string", Description: "Architectural summary explaining the layout, interactive mechanics, and user value"},
					"conditions": strArr("Concrete CHORD preconditions, inputs, and runtime boundaries"),
					"handling":   strArr("Step-by-step CHORD state handling and interactive UI flows"),
					"outcomes":   strArr("Observable visual and functional outcomes rendered in the artifact"),
					"rules":      strArr("Non-negotiable security, layout, and behavioral invariants"),
					"deltas":     strArr("Concrete state transitions and artifacts produced by this run"),
				},
				Required: []string{"title", "summary", "conditions", "handling", "outcomes", "rules", "deltas"},
			},
		},
		Required: []string{"triage", "spec"},
	}
}

func structuredBuildSchema() *llm.JSONSchema {
	return &llm.JSONSchema{
		Name: "cadence_html_artifact",
		Type: "object",
		Properties: map[string]*llm.JSONSchema{
			"gateChecks": {
				Type: "array",
				Items: &llm.JSONSchema{
					Type: "object",
					Properties: map[string]*llm.JSONSchema{
						"id":     {Type: "string"},
						"label":  {Type: "string"},
						"status": {Type: "string", Enum: []string{"pass", "warn", "fail"}},
						"detail": {Type: "string"},
					},
					Required: []string{"id", "label", "status", "detail"},
				},
			},
			"artifactHtml": {Type: "string", Description: "Self-contained HTML5/CSS document implementing the CHORD specification"},
		},
		Required: []string{"gateChecks", "artifactHtml"},
	}
}

func guardField(cfg *privacy.Config, corrID, fieldName, raw string) (string, error) {
	if raw == "" {
		return "", nil
	}
	g := privacy.NewStreamGuard(cfg, corrID)
	head, err := g.Process(raw)
	if err != nil {
		if errors.Is(err, privacy.ErrPrivacyAborted) {
			logCadenceSeam("BOUNDARY_FAULT", "cadence.privacy.stream_guard_triggered", "critical", map[string]any{
				"ruleCategory":  "builtin_secret",
				"action":        "abort",
				"field":         fieldName,
				"correlationId": corrID,
			})
		}
		return "", err
	}
	tail, err := g.Flush()
	if err != nil {
		if errors.Is(err, privacy.ErrPrivacyAborted) {
			logCadenceSeam("BOUNDARY_FAULT", "cadence.privacy.stream_guard_triggered", "critical", map[string]any{
				"ruleCategory":  "builtin_secret",
				"action":        "abort",
				"field":         fieldName,
				"correlationId": corrID,
			})
		}
		return "", err
	}
	out := head + tail
	if out != raw {
		logCadenceSeam("BOUNDARY_FAULT", "cadence.privacy.stream_guard_triggered", "warn", map[string]any{
			"ruleCategory":  "denylist",
			"action":        "redact",
			"field":         fieldName,
			"correlationId": corrID,
		})
	}
	return out, nil
}

func guardStringSlice(cfg *privacy.Config, corrID, fieldPrefix string, items []string) ([]string, error) {
	out := make([]string, len(items))
	for i, item := range items {
		cleaned, err := guardField(cfg, corrID, fmt.Sprintf("%s[%d]", fieldPrefix, i), item)
		if err != nil {
			return nil, err
		}
		out[i] = cleaned
	}
	return out, nil
}

func guardSpecOutput(cfg *privacy.Config, corrID string, out *structuredSpecOutput) error {
	var err error
	if out.Triage, err = guardField(cfg, corrID, "triage", out.Triage); err != nil {
		return err
	}
	if out.Spec.Title, err = guardField(cfg, corrID, "spec.title", out.Spec.Title); err != nil {
		return err
	}
	if out.Spec.Summary, err = guardField(cfg, corrID, "spec.summary", out.Spec.Summary); err != nil {
		return err
	}
	if out.Spec.Conditions, err = guardStringSlice(cfg, corrID, "spec.conditions", out.Spec.Conditions); err != nil {
		return err
	}
	if out.Spec.Handling, err = guardStringSlice(cfg, corrID, "spec.handling", out.Spec.Handling); err != nil {
		return err
	}
	if out.Spec.Outcomes, err = guardStringSlice(cfg, corrID, "spec.outcomes", out.Spec.Outcomes); err != nil {
		return err
	}
	if out.Spec.Rules, err = guardStringSlice(cfg, corrID, "spec.rules", out.Spec.Rules); err != nil {
		return err
	}
	if out.Spec.Deltas, err = guardStringSlice(cfg, corrID, "spec.deltas", out.Spec.Deltas); err != nil {
		return err
	}
	return nil
}

func guardBuildOutput(cfg *privacy.Config, corrID string, out *structuredBuildOutput) error {
	var err error
	for i := range out.GateChecks {
		if out.GateChecks[i].Label, err = guardField(cfg, corrID, fmt.Sprintf("gateChecks[%d].label", i), out.GateChecks[i].Label); err != nil {
			return err
		}
		if out.GateChecks[i].Detail, err = guardField(cfg, corrID, fmt.Sprintf("gateChecks[%d].detail", i), out.GateChecks[i].Detail); err != nil {
			return err
		}
	}
	if out.ArtifactHTML, err = guardField(cfg, corrID, "artifactHtml", out.ArtifactHTML); err != nil {
		return err
	}
	return nil
}

type logEmitFn func(line string)

func stripJSONCodeFence(raw string) string {
	trimmed := strings.TrimSpace(raw)
	if strings.HasPrefix(trimmed, "```") {
		if nl := strings.Index(trimmed, "\n"); nl > 0 {
			trimmed = strings.TrimSpace(trimmed[nl+1:])
		}
		trimmed = strings.TrimSuffix(trimmed, "```")
		trimmed = strings.TrimSpace(trimmed)
	}
	return trimmed
}

func streamStructuredJSON(
	ctx context.Context,
	provider llm.Provider,
	req llm.ChatStreamRequest,
	stageTag string,
	stageLabel string,
	onLog logEmitFn,
) (string, int, error) {
	if provider == nil {
		return "", 0, errors.New("no live LLM provider configured")
	}

	var buf strings.Builder
	var mu sync.Mutex
	var chunkCount int

	emitProgress := func(line string) {
		if onLog != nil {
			onLog(line)
		}
	}
	emitProgress(fmt.Sprintf("[%s] Streaming %s from %s...", stageTag, stageLabel, provider.Name()))

	stopTicker := make(chan struct{})
	var tickerWG sync.WaitGroup
	tickerWG.Add(1)
	go func() {
		defer tickerWG.Done()
		t := time.NewTicker(logProgressInterval)
		defer t.Stop()
		step := 0
		for {
			select {
			case <-ctx.Done():
				return
			case <-stopTicker:
				return
			case <-t.C:
				step++
				mu.Lock()
				bytesSoFar := buf.Len()
				chunks := chunkCount
				mu.Unlock()
				emitProgress(fmt.Sprintf("[%s] Generating %s (%d chunks, %d bytes buffered, tick #%d)...", stageTag, stageLabel, chunks, bytesSoFar, step))
			}
		}
	}()

	res, err := llm.StreamChat(ctx, provider, req, func(chunk llm.ChatStreamChunk) error {
		mu.Lock()
		defer mu.Unlock()
		if buf.Len()+len(chunk.Delta) > maxStructuredLLMBytes {
			return errStructuredBufferCap
		}
		buf.WriteString(chunk.Delta)
		chunkCount++
		return nil
	})
	close(stopTicker)
	tickerWG.Wait()

	if err != nil {
		return "", 0, err
	}

	rawJSON := strings.TrimSpace(buf.String())
	if rawJSON == "" {
		rawJSON = strings.TrimSpace(res.Text)
	}
	return stripJSONCodeFence(rawJSON), res.TokensUsed, nil
}

func invokeLLMSpecStage(
	ctx context.Context,
	provider llm.Provider,
	privacyCfg *privacy.Config,
	corrID, presetSlug, prompt string,
	recalledPatterns []string,
	onLog logEmitFn,
) (*structuredSpecOutput, int, error) {
	patternHint := "none"
	if len(recalledPatterns) > 0 {
		patternHint = strings.Join(recalledPatterns, ", ")
	}
	nonce := randomVariationNonce()

	req := llm.ChatStreamRequest{
		Messages: []llm.ChatMessage{
			{
				Role: "system",
				Content: "You are the CADENCE CHORD Specification Architect. Respond ONLY with valid JSON matching the requested schema containing `triage` and `spec` (title, summary, conditions, handling, outcomes, rules, deltas). " +
					"Write a concrete, domain-specific engineering specification tailored directly to the user's prompt — never generic boilerplate. " +
					"Include 3-5 crisp, actionable items in each CHORD section (conditions, handling, outcomes, rules, deltas) that specify exact UI widgets, data views, interactive controls, and failure/edge-case invariants. " +
					"Each run includes a fresh variation seed; choose a distinct architectural angle, layout composition, and interactive emphasis every time.",
			},
			{
				Role:    "user",
				Content: fmt.Sprintf("Run Variation Seed: %s\nPreset: %s\nRecalled Patterns: %s\nUser Prompt: %s", nonce, nonEmptyOr(presetSlug, "custom"), patternHint, prompt),
			},
		},
		MaxTokens:      1400,
		Temperature:    &specTemperature,
		ResponseSchema: structuredSpecSchema(),
		IdleTimeout:    45 * time.Second,
	}

	rawJSON, tokensUsed, err := streamStructuredJSON(ctx, provider, req, "spec", "CHORD specification", onLog)
	if err != nil {
		return nil, 0, err
	}

	var parsed structuredSpecOutput
	if unmarshalErr := json.Unmarshal([]byte(rawJSON), &parsed); unmarshalErr != nil {
		return nil, tokensUsed, fmt.Errorf("invalid structured spec JSON output: %w", unmarshalErr)
	}
	if strings.TrimSpace(parsed.Spec.Title) == "" || strings.TrimSpace(parsed.Spec.Summary) == "" {
		return nil, tokensUsed, errors.New("structured spec missing required title or summary")
	}

	if guardErr := guardSpecOutput(privacyCfg, corrID, &parsed); guardErr != nil {
		return nil, tokensUsed, guardErr
	}

	return &parsed, tokensUsed, nil
}

func invokeLLMBuildStage(
	ctx context.Context,
	provider llm.Provider,
	privacyCfg *privacy.Config,
	corrID, presetSlug, prompt string,
	spec *contracts.CadenceSpecArtifact,
	recalledPatterns []string,
	onLog logEmitFn,
) (*structuredBuildOutput, int, error) {
	patternHint := "none"
	if len(recalledPatterns) > 0 {
		patternHint = strings.Join(recalledPatterns, ", ")
	}
	specJSON, _ := json.MarshalIndent(spec, "", "  ")
	nonce := randomVariationNonce()

	req := llm.ChatStreamRequest{
		Messages: []llm.ChatMessage{
			{
				Role: "system",
				Content: "You are the CADENCE Artifact Builder. Respond ONLY with valid JSON matching the requested schema containing `gateChecks` and `artifactHtml`. " +
					"Implement the provided CHORD specification faithfully as a bespoke, self-contained single-file HTML5/CSS document. " +
					"Visual palette: dark Solar Forge (#121110 bg, #1c1a17 panels, #ffd300 gold accent, #22c55e green, #f59e0b amber, #f4efe6 text, monospace/sans typography), fluid max-width:100%, zero inner scrollbars. " +
					"Be genuinely creative with layout and pure HTML5/CSS interactivity — vary structure across runs (e.g., split panels, comparison tables, CSS radio tabs, checkbox filters, collapsible <details> runbooks, timeline flows, status gauges, metric cards) so no two runs look like the same template. " +
					"STRICT SECURITY: Never use <script>, <svg>, <iframe>, <object>, <link>, @import, or inline on* handlers.",
			},
			{
				Role: "user",
				Content: fmt.Sprintf(
					"Run Variation Seed: %s\nPreset: %s\nRecalled Patterns: %s\nUser Prompt: %s\n\nApproved CHORD Specification to Implement:\n%s",
					nonce,
					nonEmptyOr(presetSlug, "custom"),
					patternHint,
					prompt,
					string(specJSON),
				),
			},
		},
		MaxTokens:      3200,
		Temperature:    &buildTemperature,
		ResponseSchema: structuredBuildSchema(),
		IdleTimeout:    45 * time.Second,
	}

	rawJSON, tokensUsed, err := streamStructuredJSON(ctx, provider, req, "build", "bespoke HTML5/CSS artifact", onLog)
	if err != nil {
		return nil, 0, err
	}

	var parsed structuredBuildOutput
	if unmarshalErr := json.Unmarshal([]byte(rawJSON), &parsed); unmarshalErr != nil {
		return nil, tokensUsed, fmt.Errorf("invalid structured build JSON output: %w", unmarshalErr)
	}
	if !strings.Contains(strings.ToLower(parsed.ArtifactHTML), "<html") {
		return nil, tokensUsed, errors.New("structured artifactHtml missing <html> root")
	}

	if onLog != nil {
		onLog("[gate] Running post-parse privacy StreamGuard across generated artifact...")
	}
	if guardErr := guardBuildOutput(privacyCfg, corrID, &parsed); guardErr != nil {
		return nil, tokensUsed, guardErr
	}

	return &parsed, tokensUsed, nil
}
