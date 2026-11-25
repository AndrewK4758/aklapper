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
		Model:           "gemini-2.5-flash",
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

func TestLocalClientTimeoutsAllowColdLoadsWhileVertexStaysStrict(t *testing.T) {
	t.Run("defaults give LocalClient 120s cold-load runway and keep VertexClient strict", func(t *testing.T) {
		t.Setenv("AI_PROVIDER", "local")
		t.Setenv("LOCAL_LLM_HTTP_TIMEOUT_MS", "")
		t.Setenv("LOCAL_LLM_STREAM_HEADER_TIMEOUT_MS", "")
		t.Setenv("LOCAL_LLM_STREAM_IDLE_TIMEOUT_MS", "")

		localProv, ok := NewFromEnv().(*LocalClient)
		if !ok {
			t.Fatalf("expected *LocalClient from NewFromEnv")
		}
		if localProv.HTTPClient.Timeout != DefaultLocalHTTPTimeout {
			t.Fatalf("expected LocalClient HTTPClient.Timeout=%v, got %v", DefaultLocalHTTPTimeout, localProv.HTTPClient.Timeout)
		}
		localTransport, ok := localProv.StreamHTTPClient.Transport.(*http.Transport)
		if !ok || localTransport.ResponseHeaderTimeout != DefaultLocalStreamResponseHeaderTTL {
			t.Fatalf("expected LocalClient StreamHTTPClient ResponseHeaderTimeout=%v, got %+v", DefaultLocalStreamResponseHeaderTTL, localProv.StreamHTTPClient.Transport)
		}
		if got := localStreamIdleTimeout(0); got != DefaultLocalStreamIdleTimeout {
			t.Fatalf("expected LocalClient idle timeout=%v, got %v", DefaultLocalStreamIdleTimeout, got)
		}

		t.Setenv("AI_PROVIDER", "vertex")
		vertexProv, ok := NewFromEnv().(*VertexClient)
		if !ok {
			t.Fatalf("expected *VertexClient from NewFromEnv")
		}
		if vertexProv.HTTPClient.Timeout != 30*time.Second {
			t.Fatalf("expected VertexClient HTTPClient.Timeout=30s, got %v", vertexProv.HTTPClient.Timeout)
		}
		vertexTransport, ok := vertexProv.StreamHTTPClient.Transport.(*http.Transport)
		if !ok || vertexTransport.ResponseHeaderTimeout != DefaultStreamResponseHeaderTTL {
			t.Fatalf("expected VertexClient StreamHTTPClient ResponseHeaderTimeout=%v, got %+v", DefaultStreamResponseHeaderTTL, vertexProv.StreamHTTPClient.Transport)
		}
	})

	t.Run("env overrides customize LocalClient timeouts", func(t *testing.T) {
		t.Setenv("AI_PROVIDER", "local")
		t.Setenv("LOCAL_LLM_HTTP_TIMEOUT_MS", "95000")
		t.Setenv("LOCAL_LLM_STREAM_HEADER_TIMEOUT_MS", "85000")
		t.Setenv("LOCAL_LLM_STREAM_IDLE_TIMEOUT_MS", "75000")

		localProv, ok := NewFromEnv().(*LocalClient)
		if !ok {
			t.Fatalf("expected *LocalClient from NewFromEnv")
		}
		if localProv.HTTPClient.Timeout != 95*time.Second {
			t.Fatalf("expected 95s HTTPClient.Timeout, got %v", localProv.HTTPClient.Timeout)
		}
		localTransport, ok := localProv.StreamHTTPClient.Transport.(*http.Transport)
		if !ok || localTransport.ResponseHeaderTimeout != 85*time.Second {
			t.Fatalf("expected 85s ResponseHeaderTimeout, got %v", localTransport.ResponseHeaderTimeout)
		}
		if got := localStreamIdleTimeout(0); got != 75*time.Second {
			t.Fatalf("expected 75s idle timeout, got %v", got)
		}
	})
}

func TestLocalAndVertexStreamForwardThoughtDeltasSeparately(t *testing.T) {
	t.Run("local stream forwards reasoning_content as ThoughtDelta without polluting Text", func(t *testing.T) {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			w.Header().Set("Content-Type", "text/event-stream")
			_, _ = w.Write([]byte("data: {\"model\":\"laptop-egpu\",\"choices\":[{\"delta\":{\"reasoning_content\":\"Planning layout...\"},\"finish_reason\":\"\"}]}\n\n"))
			_, _ = w.Write([]byte("data: {\"model\":\"laptop-egpu\",\"choices\":[{\"delta\":{\"content\":\"{\\\"ok\\\":true}\"},\"finish_reason\":\"stop\"}],\"usage\":{\"total_tokens\":42}}\n\n"))
			_, _ = w.Write([]byte("data: [DONE]\n\n"))
		}))
		defer srv.Close()

		client := &LocalClient{BaseURL: srv.URL, ChatModel: "inference", HTTPClient: srv.Client()}
		var thoughts, outs strings.Builder
		res, err := client.ChatStream(context.Background(), ChatStreamRequest{
			Messages: []ChatMessage{{Role: "user", Content: "hi"}},
		}, func(ch ChatStreamChunk) error {
			thoughts.WriteString(ch.ThoughtDelta)
			outs.WriteString(ch.Delta)
			return nil
		})
		if err != nil {
			t.Fatalf("ChatStream: %v", err)
		}
		if thoughts.String() != "Planning layout..." {
			t.Fatalf("expected ThoughtDelta 'Planning layout...', got %q", thoughts.String())
		}
		if res.Text != `{"ok":true}` || outs.String() != `{"ok":true}` {
			t.Fatalf("expected clean output text without thought pollution, got res=%q outs=%q", res.Text, outs.String())
		}
	})

	t.Run("vertex stream extracts thought parts into ThoughtDelta separately from output", func(t *testing.T) {
		parts := []vertexPart{
			{Text: "Checking invariants...", Thought: true},
			{Text: `{"status":"ok"}`, Thought: false},
		}
		if got := extractVertexThoughtText(parts); got != "Checking invariants..." {
			t.Fatalf("expected thought text, got %q", got)
		}
		if got := extractVertexNonThoughtText(parts); got != `{"status":"ok"}` {
			t.Fatalf("expected non-thought text, got %q", got)
		}
	})
}

func TestVertexEndpointHostAndThinkingLevelValidation(t *testing.T) {
	t.Run("global, empty, and mixed-case global resolve to apex aiplatform host", func(t *testing.T) {
		for _, loc := range []string{"", "global", "  GLOBAL  "} {
			got := formatVertexEndpointBase(loc, "")
			if got != "https://aiplatform.googleapis.com" {
				t.Fatalf("formatVertexEndpointBase(%q, \"\") = %q, want https://aiplatform.googleapis.com", loc, got)
			}
			if norm := normalizeVertexLocation(loc); norm != "global" {
				t.Fatalf("normalizeVertexLocation(%q) = %q, want global", loc, norm)
			}
		}
		if got := formatVertexEndpointBase("us-central1", ""); got != "https://us-central1-aiplatform.googleapis.com" {
			t.Fatalf("regional host = %q", got)
		}
		if got := formatVertexEndpointBase("global", "http://127.0.0.1:18080/"); got != "http://127.0.0.1:18080" {
			t.Fatalf("override host = %q", got)
		}
	})

	t.Run("ParseVertexThinkingLevel normalizes valid levels and fails closed with UNSOUND_CONDITION", func(t *testing.T) {
		var logs strings.Builder
		prevOut := log.Writer()
		log.SetOutput(&logs)
		defer log.SetOutput(prevOut)

		for raw, want := range map[string]string{
			"":         "LOW",
			"low":      "LOW",
			"  Medium": "MEDIUM",
			"HIGH":     "HIGH",
		} {
			got, err := ParseVertexThinkingLevel(raw)
			if err != nil || got != want {
				t.Fatalf("ParseVertexThinkingLevel(%q) = (%q, %v), want (%q, nil)", raw, got, err, want)
			}
		}

		for _, bad := range []string{"MINIMAL", "0", "turbo"} {
			if _, err := ParseVertexThinkingLevel(bad); err == nil {
				t.Fatalf("expected ParseVertexThinkingLevel(%q) to fail closed", bad)
			}
		}
		logOut := logs.String()
		if !strings.Contains(logOut, "UNSOUND_CONDITION") || !strings.Contains(logOut, "llm.vertex.invalid_thinking_level") {
			t.Fatalf("expected UNSOUND_CONDITION llm.vertex.invalid_thinking_level seam log, got %s", logOut)
		}
	})
}

func TestVertexGemini3ThinkingLevelPayloadIncludeThoughtsAndUpstreamFault(t *testing.T) {
	var logs strings.Builder
	prevOut := log.Writer()
	log.SetOutput(&logs)
	defer log.SetOutput(prevOut)

	var capturedStreamPayload map[string]any
	var capturedStreamPath string
	var capturedUnaryPayload map[string]any

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case strings.HasSuffix(r.URL.Path, ":streamGenerateContent"):
			capturedStreamPath = r.URL.Path
			_ = json.NewDecoder(r.Body).Decode(&capturedStreamPayload)
			w.Header().Set("Content-Type", "text/event-stream")
			flusher, _ := w.(http.Flusher)
			_, _ = fmt.Fprint(w, "data: {\"candidates\":[{\"content\":{\"parts\":[{\"text\":\"reasoning step\",\"thought\":true}]}}]}\n\n")
			flusher.Flush()
			_, _ = fmt.Fprint(w, "data: {\"candidates\":[{\"content\":{\"parts\":[{\"text\":\"final delta\"}]},\"finishReason\":\"STOP\"}],\"usageMetadata\":{\"totalTokenCount\":55}}\n\n")
			flusher.Flush()
		case strings.HasSuffix(r.URL.Path, ":generateContent"):
			_ = json.NewDecoder(r.Body).Decode(&capturedUnaryPayload)
			_ = json.NewEncoder(w).Encode(map[string]any{
				"candidates": []map[string]any{{
					"content": map[string]any{
						"parts": []map[string]any{
							{"text": "hidden thought", "thought": true},
							{"text": "clean answer"},
						},
					},
				}},
				"usageMetadata": map[string]any{"totalTokenCount": 33},
			})
		default:
			http.Error(w, "upstream fault", http.StatusServiceUnavailable)
		}
	}))
	defer srv.Close()

	zero := 0
	client := &VertexClient{
		ProjectID:       "games-424800",
		Location:        "  GLOBAL ",
		Model:           "gemini-3.8-flash",
		ThinkingLevel:   "medium",
		ThinkingBudget:  &zero, // must be ignored on gemini-3*
		AccessToken:     "secret-oauth-token",
		EndpointBaseURL: srv.URL,
		HTTPClient:      srv.Client(),
	}

	var thoughts, deltas strings.Builder
	res, err := client.ChatStream(context.Background(), ChatStreamRequest{
		Messages:        []ChatMessage{{Role: "user", Content: "build"}},
		MaxTokens:       1024,
		IncludeThoughts: true,
	}, func(ch ChatStreamChunk) error {
		thoughts.WriteString(ch.ThoughtDelta)
		deltas.WriteString(ch.Delta)
		return nil
	})
	if err != nil {
		t.Fatalf("ChatStream failed: %v", err)
	}
	if !strings.Contains(capturedStreamPath, "/locations/global/publishers/google/models/gemini-3.8-flash:streamGenerateContent") {
		t.Fatalf("unexpected stream path: %q", capturedStreamPath)
	}
	if thoughts.String() != "reasoning step" || deltas.String() != "final delta" || res.Text != "final delta" {
		t.Fatalf("unexpected thought/delta split: thoughts=%q deltas=%q text=%q", thoughts.String(), deltas.String(), res.Text)
	}
	genCfg, _ := capturedStreamPayload["generationConfig"].(map[string]any)
	tc, _ := genCfg["thinkingConfig"].(map[string]any)
	if tc["thinkingLevel"] != "MEDIUM" || tc["includeThoughts"] != true {
		t.Fatalf("expected thinkingLevel=MEDIUM and includeThoughts=true, got %#v", tc)
	}
	if _, hasBudget := tc["thinkingBudget"]; hasBudget {
		t.Fatalf("expected thinkingBudget omitted on gemini-3*, got %#v", tc)
	}

	// Stream with IncludeThoughts=false omits includeThoughts
	if _, err := client.ChatStream(context.Background(), ChatStreamRequest{
		Messages:        []ChatMessage{{Role: "user", Content: "ask"}},
		MaxTokens:       1024,
		IncludeThoughts: false,
	}, nil); err != nil {
		t.Fatalf("ChatStream without includeThoughts failed: %v", err)
	}
	genCfgNoThoughts, _ := capturedStreamPayload["generationConfig"].(map[string]any)
	tcNoThoughts, _ := genCfgNoThoughts["thinkingConfig"].(map[string]any)
	if _, hasInc := tcNoThoughts["includeThoughts"]; hasInc {
		t.Fatalf("expected includeThoughts omitted when false, got %#v", tcNoThoughts)
	}

	// Unary Chat emits thinkingLevel, omits thinkingBudget, strips thought parts
	comp, err := client.Chat(context.Background(), []ChatMessage{{Role: "user", Content: "hi"}}, 1024)
	if err != nil {
		t.Fatalf("Chat failed: %v", err)
	}
	if comp.Text != "clean answer" {
		t.Fatalf("expected clean answer without thought leak, got %q", comp.Text)
	}
	uGenCfg, _ := capturedUnaryPayload["generationConfig"].(map[string]any)
	uTC, _ := uGenCfg["thinkingConfig"].(map[string]any)
	if uTC["thinkingLevel"] != "MEDIUM" {
		t.Fatalf("expected unary thinkingLevel=MEDIUM, got %#v", uTC)
	}
	if _, hasBudget := uTC["thinkingBudget"]; hasBudget {
		t.Fatalf("expected unary thinkingBudget omitted on gemini-3*, got %#v", uTC)
	}

	// NewFromEnvMap defaults and fail-closed invalid VERTEX_THINKING_LEVEL
	envClient, ok := NewFromEnvMap(func(k string) string {
		switch k {
		case "AI_PROVIDER":
			return "vertex"
		case "GCP_PROJECT_ID":
			return "games-424800"
		default:
			return ""
		}
	}).(*VertexClient)
	if !ok {
		t.Fatal("expected *VertexClient from NewFromEnvMap")
	}
	if envClient.Location != "global" || envClient.Model != "gemini-3.8-flash" || envClient.EmbedModel != "gemini-embedding-2" || envClient.ThinkingLevel != "LOW" {
		t.Fatalf("unexpected Vertex defaults from NewFromEnvMap: %+v", envClient)
	}

	invalidEnvClient, ok := NewFromEnvMap(func(k string) string {
		switch k {
		case "AI_PROVIDER":
			return "vertex"
		case "GCP_PROJECT_ID":
			return "games-424800"
		case "VERTEX_THINKING_LEVEL":
			return "MINIMAL"
		default:
			return ""
		}
	}).(*VertexClient)
	if !ok {
		t.Fatal("expected *VertexClient")
	}
	invalidEnvClient.AccessToken = "secret-oauth-token"
	invalidEnvClient.EndpointBaseURL = srv.URL
	if _, err := invalidEnvClient.Chat(context.Background(), []ChatMessage{{Role: "user", Content: "hi"}}, 64); err == nil {
		t.Fatal("expected invalid VERTEX_THINKING_LEVEL stored verbatim to fail closed in Chat")
	}

	// Upstream 503 emits BOUNDARY_FAULT without leaking secret-oauth-token
	errSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, "service unavailable", http.StatusServiceUnavailable)
	}))
	defer errSrv.Close()
	errClient := &VertexClient{
		ProjectID:       "games-424800",
		Location:        "global",
		Model:           "gemini-3.8-flash",
		AccessToken:     "secret-oauth-token",
		EndpointBaseURL: errSrv.URL,
		HTTPClient:      errSrv.Client(),
	}
	_, err = errClient.Chat(context.Background(), []ChatMessage{{Role: "user", Content: "hi"}}, 64)
	if err == nil {
		t.Fatal("expected upstream 503 error")
	}
	if strings.Contains(err.Error(), "secret-oauth-token") {
		t.Fatalf("bearer token leaked in error: %v", err)
	}
	logOut := logs.String()
	if !strings.Contains(logOut, "RULE_DIVERGENCE") || !strings.Contains(logOut, "llm.vertex.thinking_protocol_selected") {
		t.Fatalf("expected RULE_DIVERGENCE llm.vertex.thinking_protocol_selected seam log, got %s", logOut)
	}
	if !strings.Contains(logOut, "BOUNDARY_FAULT") || !strings.Contains(logOut, "llm.vertex.upstream_http_error") {
		t.Fatalf("expected BOUNDARY_FAULT llm.vertex.upstream_http_error seam log, got %s", logOut)
	}
	if strings.Contains(logOut, "secret-oauth-token") {
		t.Fatalf("bearer token leaked in logs: %s", logOut)
	}
}
