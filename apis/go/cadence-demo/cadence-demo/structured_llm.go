package main

import (
	"context"
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

var errStructuredBufferCap = errors.New("structured llm output exceeded 96 KiB buffer cap")

type structuredLLMOutput struct {
	Triage       string                           `json:"triage"`
	Spec         contracts.CadenceSpecArtifact    `json:"spec"`
	GateChecks   []contracts.CadenceGateCheckItem `json:"gateChecks"`
	ArtifactHTML string                           `json:"artifactHtml"`
}

func structuredArtifactSchema() *llm.JSONSchema {
	strArr := func(desc string) *llm.JSONSchema {
		return &llm.JSONSchema{
			Type:        "array",
			Description: desc,
			Items:       &llm.JSONSchema{Type: "string"},
		}
	}
	return &llm.JSONSchema{
		Name: "cadence_structured_artifact",
		Type: "object",
		Properties: map[string]*llm.JSONSchema{
			"triage": {Type: "string", Description: "Brief triage classification summary"},
			"spec": {
				Type: "object",
				Properties: map[string]*llm.JSONSchema{
					"title":      {Type: "string"},
					"summary":    {Type: "string"},
					"conditions": strArr("CHORD preconditions and boundaries"),
					"handling":   strArr("CHORD state handling steps"),
					"outcomes":   strArr("CHORD observable outcomes"),
					"rules":      strArr("CHORD non-negotiable invariants"),
					"deltas":     strArr("CHORD state mutations"),
				},
				Required: []string{"title", "summary", "conditions", "handling", "outcomes", "rules", "deltas"},
			},
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
			"artifactHtml": {Type: "string", Description: "Self-contained HTML5/CSS document"},
		},
		Required: []string{"triage", "spec", "gateChecks", "artifactHtml"},
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

func guardStructuredOutput(cfg *privacy.Config, corrID string, out *structuredLLMOutput) error {
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

func invokeStructuredLLM(
	ctx context.Context,
	provider llm.Provider,
	privacyCfg *privacy.Config,
	corrID, presetSlug, prompt string,
	recalledPatterns []string,
	onLog logEmitFn,
) (*structuredLLMOutput, int, error) {
	if provider == nil {
		return nil, 0, errors.New("no live LLM provider configured")
	}

	patternHint := "none"
	if len(recalledPatterns) > 0 {
		patternHint = strings.Join(recalledPatterns, ", ")
	}

	req := llm.ChatStreamRequest{
		Messages: []llm.ChatMessage{
			{
				Role: "system",
				Content: "Respond ONLY with valid JSON matching the requested schema containing triage, spec (title, summary, conditions, handling, outcomes, rules, deltas), gateChecks, and artifactHtml. " +
					"artifactHtml MUST be a self-contained single-file HTML5/CSS document with dark Solar Forge styling (#121110 bg, #1c1a17 panel, #ffd300 gold, #22c55e green, #f4efe6 text, monospace), fluid max-width:100% compact vertical rhythm with zero inner scrollbars, and interactive PURE HTML5/CSS controls (radio tabs, <details>, bars, tables). " +
					"STRICT SECURITY: Never use <script>, <svg>, <iframe>, <object>, <link>, @import, or inline on* handlers.",
			},
			{
				Role:    "user",
				Content: fmt.Sprintf("Preset: %s\nRecalled Patterns: %s\nUser Prompt: %s", nonEmptyOr(presetSlug, "custom"), patternHint, prompt),
			},
		},
		MaxTokens:      3200,
		ResponseSchema: structuredArtifactSchema(),
		IdleTimeout:    45 * time.Second,
	}

	var buf strings.Builder
	var mu sync.Mutex
	var chunkCount int

	emitProgress := func(line string) {
		if onLog != nil {
			onLog(line)
		}
	}
	emitProgress("[build] Streaming structured CHORD artifact from " + provider.Name() + "...")

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
				emitProgress(fmt.Sprintf("[build] Synthesizing CHORD spec + HTML (%d chunks, %d bytes buffered, tick #%d)...", chunks, bytesSoFar, step))
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
		return nil, 0, err
	}

	rawJSON := strings.TrimSpace(buf.String())
	if rawJSON == "" {
		rawJSON = strings.TrimSpace(res.Text)
	}
	// Strip optional markdown JSON fences if a provider wrapped structured output.
	if strings.HasPrefix(rawJSON, "```") {
		if nl := strings.Index(rawJSON, "\n"); nl > 0 {
			rawJSON = strings.TrimSpace(rawJSON[nl+1:])
		}
		rawJSON = strings.TrimSuffix(rawJSON, "```")
		rawJSON = strings.TrimSpace(rawJSON)
	}

	var parsed structuredLLMOutput
	if unmarshalErr := json.Unmarshal([]byte(rawJSON), &parsed); unmarshalErr != nil {
		return nil, res.TokensUsed, fmt.Errorf("invalid structured JSON output: %w", unmarshalErr)
	}
	if !strings.Contains(strings.ToLower(parsed.ArtifactHTML), "<html") {
		return nil, res.TokensUsed, errors.New("structured artifactHtml missing <html> root")
	}

	emitProgress("[gate] Running post-parse privacy StreamGuard across all artifact fields...")
	if guardErr := guardStructuredOutput(privacyCfg, corrID, &parsed); guardErr != nil {
		return nil, res.TokensUsed, guardErr
	}

	return &parsed, res.TokensUsed, nil
}
