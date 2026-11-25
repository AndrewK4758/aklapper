package llm

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

func TestLocalClientChatStreamDeltasAndTrailingUsage(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/chat/completions" {
			http.NotFound(w, r)
			return
		}
		var payload map[string]any
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		if payload["stream"] != true {
			http.Error(w, "expected stream=true", http.StatusBadRequest)
			return
		}
		opts, _ := payload["stream_options"].(map[string]any)
		if opts == nil || opts["include_usage"] != true {
			http.Error(w, "expected stream_options.include_usage=true", http.StatusBadRequest)
			return
		}

		time.Sleep(50 * time.Millisecond)
		w.Header().Set("Content-Type", "text/event-stream")
		flusher, _ := w.(http.Flusher)

		_, _ = fmt.Fprint(w, "data: {\"model\":\"llama-local\",\"choices\":[{\"delta\":{\"content\":\"Hello \"}}]}\n\n")
		flusher.Flush()
		time.Sleep(60 * time.Millisecond)
		_, _ = fmt.Fprint(w, "data: {\"model\":\"llama-local\",\"choices\":[{\"delta\":{\"content\":\"world!\"},\"finish_reason\":\"stop\"}]}\n\n")
		flusher.Flush()
		time.Sleep(60 * time.Millisecond)
		_, _ = fmt.Fprint(w, "data: {\"model\":\"llama-local\",\"choices\":[],\"usage\":{\"total_tokens\":142}}\n\n")
		flusher.Flush()
		_, _ = fmt.Fprint(w, "data: [DONE]\n\n")
		flusher.Flush()
	}))
	defer srv.Close()

	client := &LocalClient{
		BaseURL:    srv.URL + "/v1",
		ChatModel:  "llama-local",
		HTTPClient: &http.Client{Timeout: 80 * time.Millisecond}, // unary timeout intentionally shorter than total stream duration
	}

	var deltas []string
	var firstDeltaAt time.Time
	started := time.Now()

	res, err := StreamChat(context.Background(), client, ChatStreamRequest{
		Messages:  []ChatMessage{{Role: "user", Content: "Say hello"}},
		MaxTokens: 128,
	}, func(chunk ChatStreamChunk) error {
		if chunk.Delta != "" {
			if firstDeltaAt.IsZero() {
				firstDeltaAt = time.Now()
			}
			deltas = append(deltas, chunk.Delta)
		}
		return nil
	})
	if err != nil {
		t.Fatalf("StreamChat failed: %v", err)
	}
	if strings.Join(deltas, "") != "Hello world!" || len(deltas) != 2 {
		t.Fatalf("expected 2 incremental deltas totaling 'Hello world!', got %#v", deltas)
	}
	if firstDeltaAt.Sub(started) >= 150*time.Millisecond {
		t.Fatalf("expected incremental first delta before stream EOF, got %v", firstDeltaAt.Sub(started))
	}
	if res.Text != "Hello world!" || res.TokensUsed != 142 || res.UsageEstimated {
		t.Fatalf("unexpected stream result: %+v", res)
	}
}

func TestLocalClientChatStreamEstimatesUsageWhenOmitted(t *testing.T) {
	var logs strings.Builder
	prevOut := log.Writer()
	log.SetOutput(&logs)
	defer log.SetOutput(prevOut)

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		_, _ = fmt.Fprint(w, "data: {\"model\":\"local-no-usage\",\"choices\":[{\"delta\":{\"content\":\"Twelve chars\"}}]}\n\n")
		_, _ = fmt.Fprint(w, "data: [DONE]\n\n")
	}))
	defer srv.Close()

	client := &LocalClient{BaseURL: srv.URL + "/v1", ChatModel: "local-no-usage"}
	res, err := StreamChat(context.Background(), client, ChatStreamRequest{
		Messages: []ChatMessage{{Role: "user", Content: "Hi"}},
	}, nil)
	if err != nil {
		t.Fatalf("StreamChat failed: %v", err)
	}
	if !res.UsageEstimated || res.TokensUsed != 3 {
		t.Fatalf("expected UsageEstimated=true TokensUsed=3 (12/4), got %+v", res)
	}
	logOut := logs.String()
	if !strings.Contains(logOut, "RULE_DIVERGENCE") || !strings.Contains(logOut, "llm.stream.usage_estimated") {
		t.Fatalf("expected RULE_DIVERGENCE llm.stream.usage_estimated log, got %s", logOut)
	}
}

func TestVertexClientUnaryAndStreamFilterThoughtAndEnforceBudgetAndSchema(t *testing.T) {
	var streamPayload map[string]any
	var unaryPayload map[string]any

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case strings.HasSuffix(r.URL.Path, ":streamGenerateContent") && r.URL.Query().Get("alt") == "sse":
			_ = json.NewDecoder(r.Body).Decode(&streamPayload)
			w.Header().Set("Content-Type", "text/event-stream")
			flusher, _ := w.(http.Flusher)
			_, _ = fmt.Fprint(w, "data: {\"candidates\":[{\"content\":{\"parts\":[{\"text\":\"internal secret chain of thought\",\"thought\":true}]}}]}\n\n")
			flusher.Flush()
			_, _ = fmt.Fprint(w, "data: {\"candidates\":[{\"content\":{\"parts\":[{\"text\":\"{\\\"answer\\\":\\\"Grounded\"}]}}]}\n\n")
			flusher.Flush()
			_, _ = fmt.Fprint(w, "data: {\"candidates\":[{\"content\":{\"parts\":[{\"text\":\" reply\\\"}\"}]},\"finishReason\":\"STOP\"}],\"usageMetadata\":{\"totalTokenCount\":210}}\n\n")
			flusher.Flush()
		case strings.HasSuffix(r.URL.Path, ":generateContent"):
			_ = json.NewDecoder(r.Body).Decode(&unaryPayload)
			_ = json.NewEncoder(w).Encode(map[string]any{
				"candidates": []map[string]any{{
					"content": map[string]any{
						"parts": []map[string]any{
							{"text": "hidden unary thought", "thought": true},
							{"text": "Visible unary answer"},
						},
					},
				}},
				"usageMetadata": map[string]any{"totalTokenCount": 95},
			})
		default:
			http.NotFound(w, r)
		}
	}))
	defer srv.Close()

	zero := 0
	client := &VertexClient{
		ProjectID:       "proj-test",
		Location:        "us-central1",
		Model:           DefaultVertexModel,
		AccessToken:     "test-token",
		EndpointBaseURL: srv.URL,
		ThinkingBudget:  &zero,
	}

	schema := &JSONSchema{
		Name: "answer_payload",
		Type: "object",
		Properties: map[string]*JSONSchema{
			"answer": {Type: "string"},
		},
		Required: []string{"answer"},
	}

	var streamed strings.Builder
	streamRes, err := StreamChat(context.Background(), client, ChatStreamRequest{
		Messages:       []ChatMessage{{Role: "user", Content: "Answer in JSON"}},
		MaxTokens:      256,
		ResponseSchema: schema,
	}, func(chunk ChatStreamChunk) error {
		streamed.WriteString(chunk.Delta)
		return nil
	})
	if err != nil {
		t.Fatalf("Vertex ChatStream failed: %v", err)
	}
	if strings.Contains(streamed.String(), "internal secret chain of thought") {
		t.Fatalf("thought part leaked into stream output: %q", streamed.String())
	}
	if streamRes.Text != `{"answer":"Grounded reply"}` || streamRes.TokensUsed != 210 {
		t.Fatalf("unexpected Vertex stream result: %+v", streamRes)
	}

	genCfg, _ := streamPayload["generationConfig"].(map[string]any)
	thinkingCfg, _ := genCfg["thinkingConfig"].(map[string]any)
	if thinkingCfg == nil || thinkingCfg["thinkingBudget"] != float64(0) {
		t.Fatalf("expected stream generationConfig.thinkingConfig.thinkingBudget=0, got %#v", genCfg)
	}
	if genCfg["responseMimeType"] != "application/json" || genCfg["responseSchema"] == nil {
		t.Fatalf("expected responseMimeType and responseSchema on Vertex stream payload, got %#v", genCfg)
	}

	unaryRes, err := client.Chat(context.Background(), []ChatMessage{{Role: "user", Content: "Unary test"}}, 128)
	if err != nil {
		t.Fatalf("Vertex unary Chat failed: %v", err)
	}
	if strings.Contains(unaryRes.Text, "hidden unary thought") || unaryRes.Text != "Visible unary answer" {
		t.Fatalf("expected unary thought filtered, got %q", unaryRes.Text)
	}
	uGenCfg, _ := unaryPayload["generationConfig"].(map[string]any)
	uThinking, _ := uGenCfg["thinkingConfig"].(map[string]any)
	if uThinking == nil || uThinking["thinkingBudget"] != float64(0) {
		t.Fatalf("expected unary generationConfig.thinkingConfig.thinkingBudget=0, got %#v", uGenCfg)
	}
}

func TestValidationAndIdleTimeoutFailClosed(t *testing.T) {
	if _, err := ParseVertexThinkingBudget("-5"); err == nil {
		t.Fatal("expected negative VERTEX_THINKING_BUDGET to fail closed")
	}
	if _, err := ParseVertexThinkingBudget("abc"); err == nil {
		t.Fatal("expected non-numeric VERTEX_THINKING_BUDGET to fail closed")
	}
	b, err := ParseVertexThinkingBudget("")
	if err != nil || b == nil || *b != 0 {
		t.Fatalf("expected empty VERTEX_THINKING_BUDGET default &0, got %v err=%v", b, err)
	}

	badSchema := &JSONSchema{Type: "patternProperties"}
	if err := badSchema.Validate(); err == nil {
		t.Fatal("expected unsupported JSONSchema type patternProperties to fail closed")
	}

	var calls atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		w.Header().Set("Content-Type", "text/event-stream")
		flusher, _ := w.(http.Flusher)
		_, _ = fmt.Fprint(w, "data: {\"choices\":[{\"delta\":{\"content\":\"part1\"}}]}\n\n")
		flusher.Flush()
		<-r.Context().Done()
	}))
	defer srv.Close()

	client := &LocalClient{BaseURL: srv.URL + "/v1"}
	if _, err := client.ChatStream(context.Background(), ChatStreamRequest{
		Messages:       []ChatMessage{{Role: "user", Content: "bad schema"}},
		ResponseSchema: badSchema,
	}, nil); err == nil {
		t.Fatal("expected ChatStream to reject invalid schema before outbound HTTP")
	}
	if calls.Load() != 0 {
		t.Fatalf("expected zero HTTP requests on invalid schema, got %d", calls.Load())
	}

	_, err = client.ChatStream(context.Background(), ChatStreamRequest{
		Messages:    []ChatMessage{{Role: "user", Content: "stall test"}},
		IdleTimeout: 80 * time.Millisecond,
	}, nil)
	if err == nil || !errors.Is(err, ErrStreamIdleTimeout) {
		t.Fatalf("expected ErrStreamIdleTimeout on stalled stream, got %v", err)
	}
}

func TestDevUnlimitedFailsClosedInProductionOrVertex(t *testing.T) {
	var logs strings.Builder
	prevOut := log.Writer()
	log.SetOutput(&logs)
	defer log.SetOutput(prevOut)

	t.Run("APP_ENV production refuses AI_DEV_UNLIMITED", func(t *testing.T) {
		t.Setenv("AI_DEV_UNLIMITED", "true")
		t.Setenv("APP_ENV", "production")
		t.Setenv("NODE_ENV", "development")
		t.Setenv("AI_PROVIDER", "local")
		if IsDevUnlimitedEnabled() {
			t.Fatal("expected IsDevUnlimitedEnabled=false when APP_ENV=production")
		}
	})

	t.Run("NODE_ENV PRODUCTION refuses AI_DEV_UNLIMITED", func(t *testing.T) {
		t.Setenv("AI_DEV_UNLIMITED", "true")
		t.Setenv("APP_ENV", "development")
		t.Setenv("NODE_ENV", "PRODUCTION")
		t.Setenv("AI_PROVIDER", "local")
		if IsDevUnlimitedEnabled() {
			t.Fatal("expected IsDevUnlimitedEnabled=false when NODE_ENV=PRODUCTION")
		}
	})

	t.Run("AI_PROVIDER vertex refuses AI_DEV_UNLIMITED", func(t *testing.T) {
		t.Setenv("AI_DEV_UNLIMITED", "true")
		t.Setenv("APP_ENV", "development")
		t.Setenv("NODE_ENV", "development")
		t.Setenv("AI_PROVIDER", "vertex")
		if IsDevUnlimitedEnabled() {
			t.Fatal("expected IsDevUnlimitedEnabled=false when AI_PROVIDER=vertex")
		}
	})

	t.Run("Local dev permits AI_DEV_UNLIMITED", func(t *testing.T) {
		t.Setenv("AI_DEV_UNLIMITED", "true")
		t.Setenv("APP_ENV", "development")
		t.Setenv("NODE_ENV", "development")
		t.Setenv("AI_PROVIDER", "local")
		if !IsDevUnlimitedEnabled() {
			t.Fatal("expected IsDevUnlimitedEnabled=true in local non-prod dev")
		}
	})

	logOut := logs.String()
	if !strings.Contains(logOut, "UNSOUND_CONDITION") || !strings.Contains(logOut, "llm.config.dev_unlimited_refused") {
		t.Fatalf("expected UNSOUND_CONDITION llm.config.dev_unlimited_refused log, got %s", logOut)
	}
}

type legacyUnaryOnlyProvider struct{}

func (legacyUnaryOnlyProvider) Name() string { return "legacy-unary" }
func (legacyUnaryOnlyProvider) Chat(_ context.Context, _ []ChatMessage, _ int) (Completion, error) {
	return Completion{Text: "unary fallback", TokensUsed: 12, Model: "legacy-m"}, nil
}
func (legacyUnaryOnlyProvider) Embed(_ context.Context, _ string) ([]float32, error) {
	return nil, io.EOF
}

func TestStreamChatFallsBackForLegacyProvider(t *testing.T) {
	var got string
	res, err := StreamChat(context.Background(), legacyUnaryOnlyProvider{}, ChatStreamRequest{
		Messages: []ChatMessage{{Role: "user", Content: "hi"}},
	}, func(c ChatStreamChunk) error {
		got += c.Delta
		return nil
	})
	if err != nil || got != "unary fallback" || res.TokensUsed != 12 {
		t.Fatalf("unexpected fallback result: got=%q res=%+v err=%v", got, res, err)
	}
}
