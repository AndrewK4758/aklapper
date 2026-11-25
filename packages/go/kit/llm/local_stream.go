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

var errStreamDone = errors.New("stream done")

func (c *LocalClient) streamHTTPClient() *http.Client {
	if c.StreamHTTPClient != nil {
		return c.StreamHTTPClient
	}
	c.streamClientOnce.Do(func() {
		c.defaultStreamClient = newDefaultStreamHTTPClient(c.HTTPClient)
	})
	return c.defaultStreamClient
}

func (c *LocalClient) ChatStream(
	ctx context.Context,
	req ChatStreamRequest,
	onChunk func(ChatStreamChunk) error,
) (ChatStreamResult, error) {
	maxTokens := req.MaxTokens
	if maxTokens <= 0 {
		maxTokens = 512
	}
	model := strings.TrimSpace(req.Model)
	if model == "" {
		model = strings.TrimSpace(c.ChatModel)
	}
	if model == "" {
		model = DefaultLocalChatModel
	}
	temperature := 0.2
	if req.Temperature != nil {
		temperature = *req.Temperature
	}

	payload := map[string]any{
		"model":          model,
		"messages":       req.Messages,
		"max_tokens":     maxTokens,
		"temperature":    temperature,
		"stream":         true,
		"stream_options": map[string]any{"include_usage": true},
	}
	if req.ResponseSchema != nil {
		rf, err := req.ResponseSchema.ToOpenAIResponseFormat()
		if err != nil {
			return ChatStreamResult{}, err
		}
		payload["response_format"] = rf
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return ChatStreamResult{}, err
	}

	streamCtx, cancel := context.WithCancel(ctx)
	defer cancel()

	endpoint := strings.TrimRight(c.BaseURL, "/") + "/chat/completions"
	httpReq, err := http.NewRequestWithContext(streamCtx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return ChatStreamResult{}, err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "text/event-stream")

	res, err := c.streamHTTPClient().Do(httpReq)
	if err != nil {
		return ChatStreamResult{}, err
	}
	watched := newIdleWatchReader(res.Body, effectiveIdleTimeout(req.IdleTimeout), cancel)
	defer watched.Close()

	if res.StatusCode >= 300 {
		return ChatStreamResult{}, fmt.Errorf("local llm chat stream failed with status %d", res.StatusCode)
	}

	var fullText strings.Builder
	var finishReason string
	var tokensUsed int
	resolvedModel := model

	type openAIStreamChunk struct {
		Model   string            `json:"model"`
		Error   *upstreamSSEError `json:"error,omitempty"`
		Choices []struct {
			Delta struct {
				Content string `json:"content"`
			} `json:"delta"`
			FinishReason string `json:"finish_reason"`
		} `json:"choices"`
		Usage *struct {
			TotalTokens int `json:"total_tokens"`
		} `json:"usage"`
	}

	scanErr := scanSSEData(watched, func(eventName, data string) error {
		trimmed := strings.TrimSpace(data)
		if trimmed == "" {
			return nil
		}
		if strings.EqualFold(eventName, "error") {
			var envelope struct {
				Error *upstreamSSEError `json:"error"`
			}
			if json.Unmarshal([]byte(trimmed), &envelope) == nil && envelope.Error != nil {
				return formatUpstreamSSEError("local llm", envelope.Error)
			}
			return fmt.Errorf("local llm stream error event")
		}
		if trimmed == "[DONE]" {
			return errStreamDone
		}
		var chunk openAIStreamChunk
		if unmarshalErr := json.Unmarshal([]byte(trimmed), &chunk); unmarshalErr != nil {
			return fmt.Errorf("decode local llm stream chunk: %w", unmarshalErr)
		}
		if chunk.Error != nil {
			return formatUpstreamSSEError("local llm", chunk.Error)
		}
		if strings.TrimSpace(chunk.Model) != "" {
			resolvedModel = chunk.Model
		}
		if chunk.Usage != nil && chunk.Usage.TotalTokens > 0 {
			tokensUsed = chunk.Usage.TotalTokens
		}
		if len(chunk.Choices) == 0 {
			return nil
		}
		delta := chunk.Choices[0].Delta.Content
		if chunk.Choices[0].FinishReason != "" {
			finishReason = chunk.Choices[0].FinishReason
		}
		if delta != "" {
			fullText.WriteString(delta)
			if onChunk != nil {
				if cbErr := onChunk(ChatStreamChunk{Delta: delta, FinishReason: finishReason}); cbErr != nil {
					return cbErr
				}
			}
		}
		return nil
	})
	if scanErr != nil && !errors.Is(scanErr, errStreamDone) {
		return ChatStreamResult{
			Text:         fullText.String(),
			Model:        resolvedModel,
			FinishReason: finishReason,
			TokensUsed:   tokensUsed,
		}, scanErr
	}

	outText := fullText.String()
	usageEstimated := false
	if tokensUsed == 0 && outText != "" {
		tokensUsed = estimateTokensFromText(outText)
		usageEstimated = true
		logLLMSeam("RULE_DIVERGENCE", "llm.stream.usage_estimated", map[string]any{
			"branch":     "estimated",
			"provider":   c.Name(),
			"model":      resolvedModel,
			"tokensUsed": tokensUsed,
		})
	}

	return ChatStreamResult{
		Text:           outText,
		Model:          resolvedModel,
		FinishReason:   finishReason,
		TokensUsed:     tokensUsed,
		UsageEstimated: usageEstimated,
	}, nil
}
