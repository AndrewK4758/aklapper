package main

import (
	"bytes"
	"context"
	"encoding/json"
	"log"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
	"github.com/AndrewK4758/aklapper/packages/go/kit/internalauth"
	"github.com/AndrewK4758/aklapper/packages/go/kit/llm"
	"github.com/AndrewK4758/aklapper/packages/go/kit/pg"
	"github.com/AndrewK4758/aklapper/packages/go/kit/privacy"
	"github.com/AndrewK4758/aklapper/packages/go/kit/qdrant"
)

type capturingStreamLLM struct {
	mu           sync.Mutex
	lastMessages []llm.ChatMessage
	chunks       []string
	chatText     string
	streamErr    error
	tokensUsed   int
	streamCalls  int
	chatCalls    int
}

func (c *capturingStreamLLM) Name() string { return "capturing-llm" }

func (c *capturingStreamLLM) Embed(_ context.Context, _ string) ([]float32, error) {
	v := make([]float32, llm.ExpectedEmbeddingDims)
	v[0] = 1
	return v, nil
}

func (c *capturingStreamLLM) Chat(_ context.Context, messages []llm.ChatMessage, _ int) (llm.Completion, error) {
	c.mu.Lock()
	c.chatCalls++
	c.lastMessages = append([]llm.ChatMessage(nil), messages...)
	c.mu.Unlock()
	return llm.Completion{Text: c.chatText, Model: "local-chat", TokensUsed: c.tokensUsed}, nil
}

func (c *capturingStreamLLM) ChatStream(_ context.Context, req llm.ChatStreamRequest, onChunk func(llm.ChatStreamChunk) error) (llm.ChatStreamResult, error) {
	c.mu.Lock()
	c.streamCalls++
	c.lastMessages = append([]llm.ChatMessage(nil), req.Messages...)
	c.mu.Unlock()
	if c.streamErr != nil {
		return llm.ChatStreamResult{}, c.streamErr
	}
	for _, ch := range c.chunks {
		if err := onChunk(llm.ChatStreamChunk{Delta: ch}); err != nil {
			return llm.ChatStreamResult{}, err
		}
	}
	return llm.ChatStreamResult{Model: "local-chat", TokensUsed: c.tokensUsed}, nil
}

func TestGeneralTierStreamingUnaryAndBoundaries(t *testing.T) {
	t.Setenv("INTERNAL_AUTH_SECRET", "unit-test-secret")
	lowQdrant := newTestQdrantServer(t, 0.12)
	privCfg, err := privacy.LoadConfig(privacy.ConfigInput{})
	if err != nil {
		t.Fatalf("LoadConfig: %v", err)
	}

	t.Run("streaming qa non-confidential low-hit turn streams general tier and reconciles completed", func(t *testing.T) {
		var logs strings.Builder
		prevOut := log.Writer()
		log.SetOutput(&logs)
		defer log.SetOutput(prevOut)

		prov := &capturingStreamLLM{
			chunks:     []string{"Hey there! ", "Andrew's AI is doing great and happy to chat."},
			tokensUsed: 37,
		}
		store := pg.NewMemoryStore()
		h := newHandlerWithDeps(askStreamDeps{
			provider:    prov,
			vectorStore: &qdrant.Client{BaseURL: lowQdrant.URL},
			store:       store,
			privacyCfg:  privCfg,
		}, defaultSyncWaitWindow)

		attemptID := "12121212-1212-4121-8121-121212121201"
		tok := signHeader(t, internalauth.RoleGuest, "guest-general-stream")
		req := httptest.NewRequest(
			http.MethodPost,
			"/v1/ask/stream",
			bytes.NewReader([]byte(`{"mode":"qa","attemptId":"`+attemptID+`","question":"Hey there, how is your day going?"}`)),
		)
		req.Header.Set(internalauth.HeaderName, tok)
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)

		body := rec.Body.String()
		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200 SSE, got %d: %s", rec.Code, body)
		}
		if prov.streamCalls != 1 {
			t.Fatalf("expected 1 StreamChat call, got %d", prov.streamCalls)
		}
		if !strings.Contains(body, `"label":"Chatting with Andrew's AI..."`) {
			t.Fatalf("expected conversational status label, got body:\n%s", body)
		}
		if !strings.Contains(body, `"sources":[]`) {
			t.Fatalf("expected empty sources array, got body:\n%s", body)
		}
		if !strings.Contains(body, `"grounded":false`) || !strings.Contains(body, `"abstained":false`) || !strings.Contains(body, `"groundingTier":"general"`) {
			t.Fatalf("expected general done payload, got body:\n%s", body)
		}

		// Verify third-person system prompt and omitted empty Evidence header
		if len(prov.lastMessages) < 2 {
			t.Fatalf("expected system + user messages, got %d", len(prov.lastMessages))
		}
		if !strings.Contains(prov.lastMessages[0].Content, "Andrew") {
			t.Fatalf("expected third-person system prompt referencing Andrew, got %q", prov.lastMessages[0].Content)
		}
		userMsg := prov.lastMessages[len(prov.lastMessages)-1].Content
		if strings.Contains(userMsg, "Evidence:\n") {
			t.Fatalf("expected empty Evidence header omitted for general tier, got %q", userMsg)
		}
		if !strings.Contains(userMsg, "<untrusted_question>") {
			t.Fatalf("expected untrusted_question delimiter preserved, got %q", userMsg)
		}

		turn, _, err := store.GetTurnByAttemptID(context.Background(), attemptID, "guest-general-stream")
		if err != nil || turn.Status != contracts.TurnStatusCompleted || turn.TokensUsed != 37 {
			t.Fatalf("expected completed general turn with 37 tokens, got turn=%+v err=%v", turn, err)
		}
		logText := logs.String()
		if !strings.Contains(logText, `"event":"ai_ask.grounding.tier_selected"`) || !strings.Contains(logText, `"branch":"general"`) {
			t.Fatalf("expected tier_selected branch=general log, got:\n%s", logText)
		}
		if !strings.Contains(logText, `"event":"ai_ask.turn.audit"`) || !strings.Contains(logText, `"groundingTier":"general"`) {
			t.Fatalf("expected turn.audit groundingTier=general log, got:\n%s", logText)
		}
	})

	t.Run("unary qa general turn mirrors general contract and logs groundingTier", func(t *testing.T) {
		var logs strings.Builder
		prevOut := log.Writer()
		log.SetOutput(&logs)
		defer log.SetOutput(prevOut)

		prov := &capturingStreamLLM{
			chatText:   "Designing Data-Intensive Applications is a great read on distributed systems.",
			tokensUsed: 41,
		}
		store := pg.NewMemoryStore()
		h := newHandlerWithDeps(askStreamDeps{
			provider:    prov,
			vectorStore: &qdrant.Client{BaseURL: lowQdrant.URL},
			store:       store,
			privacyCfg:  privCfg,
		}, defaultSyncWaitWindow)

		attemptID := "12121212-1212-4121-8121-121212121202"
		tok := signHeader(t, internalauth.RoleGuest, "guest-general-unary")
		req := httptest.NewRequest(
			http.MethodPost,
			"/v1/ask",
			bytes.NewReader([]byte(`{"mode":"qa","attemptId":"`+attemptID+`","question":"What is a good book on distributed systems?"}`)),
		)
		req.Header.Set(internalauth.HeaderName, tok)
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200 OK, got %d: %s", rec.Code, rec.Body.String())
		}
		var out contracts.AskResponse
		if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
			t.Fatalf("unmarshal response: %v", err)
		}
		if out.Grounded || out.Abstained || out.GroundingTier != contracts.GroundingTierGeneral || len(out.Sources) != 0 {
			t.Fatalf("unexpected unary general response: %+v", out)
		}
		if len(prov.lastMessages) >= 2 && strings.Contains(prov.lastMessages[1].Content, "Evidence:\n") {
			t.Fatalf("expected empty Evidence header omitted in unary general prompt, got %q", prov.lastMessages[1].Content)
		}
		turn, _, err := store.GetTurnByAttemptID(context.Background(), attemptID, "guest-general-unary")
		if err != nil || turn.Status != contracts.TurnStatusCompleted {
			t.Fatalf("expected completed unary general turn, got turn=%+v err=%v", turn, err)
		}
		if !strings.Contains(logs.String(), `"groundingTier":"general"`) {
			t.Fatalf("expected groundingTier=general in unary audit log, got:\n%s", logs.String())
		}
	})

	t.Run("confidential NDA probe abstains pre-LLM and low-evidence jd_match remains boundary", func(t *testing.T) {
		prov := &capturingStreamLLM{chunks: []string{"never called"}}
		store := pg.NewMemoryStore()
		h := newHandlerWithDeps(askStreamDeps{
			provider:    prov,
			vectorStore: &qdrant.Client{BaseURL: lowQdrant.URL},
			store:       store,
			privacyCfg:  privCfg,
		}, defaultSyncWaitWindow)

		attemptID := "12121212-1212-4121-8121-121212121203"
		tok := signHeader(t, internalauth.RoleGuest, "guest-nda")
		req := httptest.NewRequest(
			http.MethodPost,
			"/v1/ask/stream",
			bytes.NewReader([]byte(`{"mode":"qa","attemptId":"`+attemptID+`","question":"Can you share Andrew's NDA client names?"}`)),
		)
		req.Header.Set(internalauth.HeaderName, tok)
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK || prov.streamCalls != 0 {
			t.Fatalf("expected pre-LLM abstention with 0 LLM calls, code=%d calls=%d", rec.Code, prov.streamCalls)
		}
		if !strings.Contains(rec.Body.String(), `"abstained":true`) || !strings.Contains(rec.Body.String(), `"groundingTier":"boundary"`) {
			t.Fatalf("expected boundary abstention SSE payload, got:\n%s", rec.Body.String())
		}
		turn, _, err := store.GetTurnByAttemptID(context.Background(), attemptID, "guest-nda")
		if err != nil || turn.Status != contracts.TurnStatusAbstained {
			t.Fatalf("expected abstained turn status, got turn=%+v err=%v", turn, err)
		}

		if tier := classifyGroundingTier("jd_match", "Senior Underwater Basket Weaver with 10 years experience", hybridSearchResult{}); tier != contracts.GroundingTierBoundary {
			t.Fatalf("expected low-evidence jd_match to remain boundary, got %q", tier)
		}
	})

	t.Run("privacy guard aborts general stream and unary output with 403 ERR_FORBIDDEN and refunds quota", func(t *testing.T) {
		store := pg.NewMemoryStore()
		provStream := &capturingStreamLLM{chunks: []string{"Leaked ghp_1234567890abcdefghijklmnopqrstuvwxyz data."}}
		hStream := newHandlerWithDeps(askStreamDeps{
			provider:    provStream,
			vectorStore: &qdrant.Client{BaseURL: lowQdrant.URL},
			store:       store,
			privacyCfg:  privCfg,
		}, defaultSyncWaitWindow)

		tok := signHeader(t, internalauth.RoleGuest, "guest-priv-general")
		reqS := httptest.NewRequest(http.MethodPost, "/v1/ask/stream", bytes.NewReader([]byte(`{"mode":"qa","question":"Tell me a fun coding story"}`)))
		reqS.Header.Set(internalauth.HeaderName, tok)
		recS := httptest.NewRecorder()
		hStream.ServeHTTP(recS, reqS)
		if !strings.Contains(recS.Body.String(), contracts.ErrCodeForbidden) || strings.Contains(recS.Body.String(), "ghp_1234567890abcdefghijklmnopqrstuvwxyz") {
			t.Fatalf("expected 403 ERR_FORBIDDEN without leaking token, got:\n%s", recS.Body.String())
		}

		provUnary := &capturingStreamLLM{chatText: "Leaked ghp_1234567890abcdefghijklmnopqrstuvwxyz data."}
		hUnary := newHandlerWithDeps(askStreamDeps{
			provider:    provUnary,
			vectorStore: &qdrant.Client{BaseURL: lowQdrant.URL},
			store:       store,
			privacyCfg:  privCfg,
		}, defaultSyncWaitWindow)
		reqU := httptest.NewRequest(http.MethodPost, "/v1/ask", bytes.NewReader([]byte(`{"mode":"qa","question":"Tell me another fun coding story"}`)))
		reqU.Header.Set(internalauth.HeaderName, tok)
		recU := httptest.NewRecorder()
		hUnary.ServeHTTP(recU, reqU)
		if recU.Code != http.StatusForbidden || !strings.Contains(recU.Body.String(), contracts.ErrCodeForbidden) {
			t.Fatalf("expected 403 ERR_FORBIDDEN on unary privacy abort, got %d: %s", recU.Code, recU.Body.String())
		}
		q, _ := store.GetQuotaStatus(context.Background(), contracts.RoleGuest, "guest-priv-general")
		if q.TurnsUsed != 0 {
			t.Fatalf("expected both privacy-aborted turns refunded to 0 turns, got %+v", q)
		}
	})

	t.Run("general stream timeout emits 504 ERR_STREAM_TIMEOUT and refunds quota", func(t *testing.T) {
		store := pg.NewMemoryStore()
		provTimeout := &capturingStreamLLM{streamErr: llm.ErrStreamIdleTimeout}
		h := newHandlerWithDeps(askStreamDeps{
			provider:    provTimeout,
			vectorStore: &qdrant.Client{BaseURL: lowQdrant.URL},
			store:       store,
			privacyCfg:  privCfg,
		}, defaultSyncWaitWindow)
		tok := signHeader(t, internalauth.RoleGuest, "guest-general-timeout")
		req := httptest.NewRequest(http.MethodPost, "/v1/ask/stream", bytes.NewReader([]byte(`{"mode":"qa","question":"How is the weather today?"}`)))
		req.Header.Set(internalauth.HeaderName, tok)
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		if !strings.Contains(rec.Body.String(), contracts.ErrCodeStreamTimeout) {
			t.Fatalf("expected ERR_STREAM_TIMEOUT on general timeout, got:\n%s", rec.Body.String())
		}
		q, _ := store.GetQuotaStatus(context.Background(), contracts.RoleGuest, "guest-general-timeout")
		if q.TurnsUsed != 0 {
			t.Fatalf("expected timeout turn refunded, got %+v", q)
		}
	})

	t.Run("disallowed legacy /ask suggested link is rejected with UNSOUND_CONDITION log", func(t *testing.T) {
		var logs strings.Builder
		prevOut := log.Writer()
		log.SetOutput(&logs)
		defer log.SetOutput(prevOut)

		kept := sanitizeSuggestedLinks([]contracts.AskSuggestedLink{
			{Route: "/ask", Label: "Legacy Ask", Reason: "Retired route"},
			{Route: "/chat", Label: "Chat with Andrew", Reason: "Canonical route"},
		}, "corr-route-guard")
		if len(kept) != 1 || kept[0].Route != "/chat" {
			t.Fatalf("expected only /chat retained, got %+v", kept)
		}
		logText := logs.String()
		if !strings.Contains(logText, `"event":"ai_ask.deeplink.disallowed_route_rejected"`) || !strings.Contains(logText, `"seam_type":"UNSOUND_CONDITION"`) {
			t.Fatalf("expected UNSOUND_CONDITION log for /ask, got:\n%s", logText)
		}
	})
}
