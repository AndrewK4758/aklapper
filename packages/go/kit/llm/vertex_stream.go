package llm

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
)

type vertexPart struct {
	Text    string `json:"text"`
	Thought bool   `json:"thought"`
}

func extractVertexNonThoughtText(parts []vertexPart) string {
	var out strings.Builder
	for _, part := range parts {
		if part.Thought {
			continue
		}
		out.WriteString(part.Text)
	}
	return out.String()
}

func extractVertexThoughtText(parts []vertexPart) string {
	var out strings.Builder
	for _, part := range parts {
		if !part.Thought {
			continue
		}
		out.WriteString(part.Text)
	}
	return out.String()
}

func buildVertexGeneratePayload(
	messages []ChatMessage,
	maxTokens int,
	temperature *float64,
	thinkingBudget *int,
	schema *JSONSchema,
) (map[string]any, error) {
	if maxTokens <= 0 {
		maxTokens = 512
	}
	temp := 0.2
	if temperature != nil {
		temp = *temperature
	}
	if thinkingBudget != nil && *thinkingBudget < 0 {
		return nil, fmt.Errorf("invalid vertex thinkingBudget %d: must be non-negative", *thinkingBudget)
	}

	var systemParts []map[string]string
	contents := make([]map[string]any, 0, len(messages))
	for _, msg := range messages {
		if strings.EqualFold(msg.Role, "system") {
			systemParts = append(systemParts, map[string]string{"text": msg.Content})
			continue
		}
		role := "user"
		if strings.EqualFold(msg.Role, "assistant") || strings.EqualFold(msg.Role, "model") {
			role = "model"
		}
		contents = append(contents, map[string]any{
			"role":  role,
			"parts": []map[string]string{{"text": msg.Content}},
		})
	}
	if len(contents) == 0 {
		contents = append(contents, map[string]any{
			"role":  "user",
			"parts": []map[string]string{{"text": ""}},
		})
	}

	genCfg := map[string]any{
		"maxOutputTokens": maxTokens,
		"temperature":     temp,
	}
	if thinkingBudget != nil {
		genCfg["thinkingConfig"] = map[string]any{
			"thinkingBudget": *thinkingBudget,
		}
	}
	if schema != nil {
		vs, err := schema.ToVertexSchema()
		if err != nil {
			return nil, err
		}
		genCfg["responseMimeType"] = "application/json"
		genCfg["responseSchema"] = vs
	}

	payload := map[string]any{
		"contents":         contents,
		"generationConfig": genCfg,
	}
	if len(systemParts) > 0 {
		payload["systemInstruction"] = map[string]any{"parts": systemParts}
	}
	return payload, nil
}

func (v *VertexClient) streamHTTPClient() *http.Client {
	if v.StreamHTTPClient != nil {
		return v.StreamHTTPClient
	}
	v.streamClientOnce.Do(func() {
		v.defaultStreamClient = newDefaultStreamHTTPClient(v.HTTPClient)
	})
	return v.defaultStreamClient
}

func (v *VertexClient) ChatStream(
	ctx context.Context,
	req ChatStreamRequest,
	onChunk func(ChatStreamChunk) error,
) (ChatStreamResult, error) {
	if strings.TrimSpace(v.ProjectID) == "" {
		return ChatStreamResult{}, errors.New("vertex ai provider requires GCP_PROJECT_ID")
	}

	effectiveBudget := v.ThinkingBudget
	if req.ThinkingBudget != nil {
		effectiveBudget = req.ThinkingBudget
	}
	payload, err := buildVertexGeneratePayload(req.Messages, req.MaxTokens, req.Temperature, effectiveBudget, req.ResponseSchema)
	if err != nil {
		return ChatStreamResult{}, err
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return ChatStreamResult{}, err
	}

	token, err := v.resolveAccessToken(ctx)
	if err != nil {
		return ChatStreamResult{}, err
	}

	model := strings.TrimSpace(req.Model)
	if model == "" {
		model = strings.TrimSpace(v.Model)
	}
	if model == "" {
		model = DefaultVertexModel
	}
	loc := strings.TrimSpace(v.Location)
	if loc == "" {
		loc = DefaultVertexLocation
	}

	streamCtx, cancel := context.WithCancel(ctx)
	defer cancel()

	endpoint := fmt.Sprintf(
		"%s/v1/projects/%s/locations/%s/publishers/google/models/%s:streamGenerateContent?alt=sse",
		v.endpointBase(),
		v.ProjectID,
		loc,
		model,
	)
	httpReq, err := http.NewRequestWithContext(streamCtx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return ChatStreamResult{}, err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "text/event-stream")
	httpReq.Header.Set("Authorization", "Bearer "+token)

	res, err := v.streamHTTPClient().Do(httpReq)
	if err != nil {
		return ChatStreamResult{}, err
	}
	watched := newIdleWatchReader(res.Body, effectiveIdleTimeout(req.IdleTimeout), cancel)
	defer watched.Close()

	if res.StatusCode >= 300 {
		return ChatStreamResult{}, fmt.Errorf("vertex ai streamGenerateContent failed with status %d", res.StatusCode)
	}

	var fullText strings.Builder
	var finishReason string
	var tokensUsed int

	type vertexStreamFrame struct {
		Error      *upstreamSSEError `json:"error,omitempty"`
		Candidates []struct {
			Content struct {
				Parts []vertexPart `json:"parts"`
			} `json:"content"`
			FinishReason string `json:"finishReason"`
		} `json:"candidates"`
		UsageMetadata struct {
			PromptTokenCount     int `json:"promptTokenCount"`
			CandidatesTokenCount int `json:"candidatesTokenCount"`
			TotalTokenCount      int `json:"totalTokenCount"`
		} `json:"usageMetadata"`
	}

	scanErr := scanSSEData(watched, func(eventName, data string) error {
		trimmed := strings.TrimSpace(data)
		if trimmed == "" || trimmed == "[DONE]" {
			return nil
		}
		if strings.EqualFold(eventName, "error") {
			var envelope struct {
				Error *upstreamSSEError `json:"error"`
			}
			if json.Unmarshal([]byte(trimmed), &envelope) == nil && envelope.Error != nil {
				return formatUpstreamSSEError("vertex ai", envelope.Error)
			}
			return fmt.Errorf("vertex ai stream error event")
		}
		var frame vertexStreamFrame
		if unmarshalErr := json.Unmarshal([]byte(trimmed), &frame); unmarshalErr != nil {
			return fmt.Errorf("decode vertex stream frame: %w", unmarshalErr)
		}
		if frame.Error != nil {
			return formatUpstreamSSEError("vertex ai", frame.Error)
		}
		if frame.UsageMetadata.TotalTokenCount > 0 {
			tokensUsed = frame.UsageMetadata.TotalTokenCount
		} else if sum := frame.UsageMetadata.PromptTokenCount + frame.UsageMetadata.CandidatesTokenCount; sum > 0 {
			tokensUsed = sum
		}
		if len(frame.Candidates) == 0 {
			return nil
		}
		cand := frame.Candidates[0]
		if cand.FinishReason != "" {
			finishReason = cand.FinishReason
		}
		delta := extractVertexNonThoughtText(cand.Content.Parts)
		thoughtDelta := extractVertexThoughtText(cand.Content.Parts)
		if delta != "" {
			fullText.WriteString(delta)
		}
		if (delta != "" || thoughtDelta != "") && onChunk != nil {
			if cbErr := onChunk(ChatStreamChunk{
				Delta:        delta,
				ThoughtDelta: thoughtDelta,
				FinishReason: finishReason,
			}); cbErr != nil {
				return cbErr
			}
		}
		return nil
	})
	if scanErr != nil {
		return ChatStreamResult{
			Text:         fullText.String(),
			Model:        model,
			FinishReason: finishReason,
			TokensUsed:   tokensUsed,
		}, scanErr
	}

	return ChatStreamResult{
		Text:         fullText.String(),
		Model:        model,
		FinishReason: finishReason,
		TokensUsed:   tokensUsed,
	}, nil
}
