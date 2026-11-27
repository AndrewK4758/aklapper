package main

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
	"github.com/AndrewK4758/aklapper/packages/go/kit/internalauth"
	"github.com/AndrewK4758/aklapper/packages/go/kit/llm"
	"github.com/AndrewK4758/aklapper/packages/go/kit/pg"
	"github.com/AndrewK4758/aklapper/packages/go/kit/privacy"
	"github.com/AndrewK4758/aklapper/packages/go/kit/qdrant"
)

type multiTurnStubLLM struct {
	rewriteCalls atomic.Int32
	streamCalls  atomic.Int32
	lastMessages []llm.ChatMessage
}

func (m *multiTurnStubLLM) Name() string { return "multiturn-stub" }
func (m *multiTurnStubLLM) Embed(_ context.Context, _ string) ([]float32, error) {
	v := make([]float32, llm.ExpectedEmbeddingDims)
	v[0] = 0.9
	return v, nil
}
func (m *multiTurnStubLLM) Chat(_ context.Context, _ []llm.ChatMessage, _ int) (llm.Completion, error) {
	m.rewriteCalls.Add(1)
	return llm.Completion{Text: "Andrew Klapper GCP Cloud Run deployment", Model: "stub-v1", TokensUsed: 18}, nil
}
func (m *multiTurnStubLLM) ChatStream(_ context.Context, req llm.ChatStreamRequest, onChunk func(llm.ChatStreamChunk) error) (llm.ChatStreamResult, error) {
	m.streamCalls.Add(1)
	m.lastMessages = append([]llm.ChatMessage(nil), req.Messages...)
	answer := "Andrew architects Cloud Run SSR and GKE Autopilot services."
	if onChunk != nil {
		if err := onChunk(llm.ChatStreamChunk{Delta: answer}); err != nil {
			return llm.ChatStreamResult{}, err
		}
	}
	return llm.ChatStreamResult{Text: answer, Model: "stub-v1", TokensUsed: 55, FinishReason: "stop"}, nil
}

func TestStreamingMultiTurnRecallCrossSessionIsolationAndPromptRedaction(t *testing.T) {
	t.Setenv("INTERNAL_AUTH_SECRET", "unit-test-secret")
	qSrv := newTestQdrantServer(t, 0.91)
	privCfg, err := privacy.LoadConfig(privacy.ConfigInput{
		RawDenylist:    `["SyntheticConfidentialClientX"]`,
		DenylistAction: privacy.ActionRedact,
		SecretAction:   ActionAbortFallback(),
	})
	if err != nil {
		t.Fatalf("LoadConfig: %v", err)
	}
	store := pg.NewMemoryStore()
	provider := &multiTurnStubLLM{}
	h := newHandlerWithDeps(askStreamDeps{
		provider:    provider,
		vectorStore: &qdrant.Client{BaseURL: qSrv.URL},
		store:       store,
		privacyCfg:  privCfg,
	}, defaultSyncWaitWindow)

	tokS1 := signHeader(t, internalauth.RoleGuest, "session-s1")
	tokS2 := signHeader(t, internalauth.RoleGuest, "session-s2")
	convID := "11111111-2222-4333-8444-555555555555"

	// Turn 1: Profile overview intent skips rewrite (0 rewrite calls) and redacts sensitive prompt before storing
	att1 := "11111111-1111-4111-8111-111111111101"
	body1, _ := json.Marshal(map[string]any{
		"mode":           "qa",
		"attemptId":      att1,
		"conversationId": convID,
		"visitorLens":    "hiring-manager",
		"question":       "Who is Andrew Klapper and did he work on SyntheticConfidentialClientX with AKIAIOSFODNN7EXAMPLE?",
	})
	req1 := httptest.NewRequest(http.MethodPost, "/v1/ask/stream", bytes.NewReader(body1))
	req1.Header.Set(internalauth.HeaderName, tokS1)
	rec1 := httptest.NewRecorder()
	h.ServeHTTP(rec1, req1)

	if rec1.Code != http.StatusOK {
		t.Fatalf("turn 1 failed: %d %s", rec1.Code, rec1.Body.String())
	}
	if provider.rewriteCalls.Load() != 0 {
		t.Fatalf("expected 0 rewrite calls on turn 1, got %d", provider.rewriteCalls.Load())
	}
	raw1 := rec1.Body.String()
	for _, want := range []string{
		"event: status\n",
		"event: meta\n",
		"event: sources\n",
		"event: done\n",
		`"groundingTier":"profile"`,
		`"turnIndex":1`,
		`"conversationId":"` + convID + `"`,
		`"suggestedLinks":[`,
		`"followUpQuestions":[`,
	} {
		if !strings.Contains(raw1, want) {
			t.Fatalf("turn 1 SSE missing %s:\n%s", want, raw1)
		}
	}

	// Verify stored prompt_text is redacted cleanly on qa
	storedTurn1, _, err := store.GetTurnByAttemptID(context.Background(), att1, "session-s1")
	if err != nil {
		t.Fatalf("GetTurnByAttemptID turn 1: %v", err)
	}
	if strings.Contains(storedTurn1.PromptText, "SyntheticConfidentialClientX") || strings.Contains(storedTurn1.PromptText, "AKIAIOSFODNN7EXAMPLE") {
		t.Fatalf("ask_turns.prompt_text leaked sensitive literal: %q", storedTurn1.PromptText)
	}

	// Turn 2 (same session + conversationId): triggers rewrite and includes history -> turnIndex 2
	att2 := "11111111-1111-4111-8111-111111111102"
	body2, _ := json.Marshal(map[string]any{
		"mode":           "qa",
		"attemptId":      att2,
		"conversationId": convID,
		"question":       "How did he deploy that on GCP?",
	})
	req2 := httptest.NewRequest(http.MethodPost, "/v1/ask/stream", bytes.NewReader(body2))
	req2.Header.Set(internalauth.HeaderName, tokS1)
	rec2 := httptest.NewRecorder()
	h.ServeHTTP(rec2, req2)
	if rec2.Code != http.StatusOK {
		t.Fatalf("turn 2 failed: %d %s", rec2.Code, rec2.Body.String())
	}
	if provider.rewriteCalls.Load() != 1 {
		t.Fatalf("expected 1 rewrite call on turn 2, got %d", provider.rewriteCalls.Load())
	}
	if !strings.Contains(rec2.Body.String(), `"turnIndex":2`) || !strings.Contains(rec2.Body.String(), `"groundingTier":"evidence"`) {
		t.Fatalf("turn 2 missing turnIndex=2 or evidence tier:\n%s", rec2.Body.String())
	}
	if len(provider.lastMessages) < 4 {
		t.Fatalf("expected prior conversation turn messages included in LLM prompt, got %d messages", len(provider.lastMessages))
	}

	// Cross-session spoof: session-s2 referencing convID must see 0 history and start at turnIndex 1
	attSpoof := "11111111-1111-4111-8111-111111111103"
	bodySpoof, _ := json.Marshal(map[string]any{
		"mode":           "qa",
		"attemptId":      attSpoof,
		"conversationId": convID,
		"question":       "How did he deploy that on GCP?",
	})
	reqSpoof := httptest.NewRequest(http.MethodPost, "/v1/ask/stream", bytes.NewReader(bodySpoof))
	reqSpoof.Header.Set(internalauth.HeaderName, tokS2)
	recSpoof := httptest.NewRecorder()
	h.ServeHTTP(recSpoof, reqSpoof)
	if recSpoof.Code != http.StatusOK || !strings.Contains(recSpoof.Body.String(), `"turnIndex":1`) {
		t.Fatalf("cross-session turn did not isolate to turnIndex=1: %d %s", recSpoof.Code, recSpoof.Body.String())
	}
	if provider.rewriteCalls.Load() != 1 {
		t.Fatalf("cross-session spoof should see 0 history and run 0 additional rewrites, got %d", provider.rewriteCalls.Load())
	}

	// Unary jd_match persists a privacy-redacted prompt_text excerpt bounded to <= 1000 runes
	attJD := "11111111-1111-4111-8111-111111111104"
	bodyJD, _ := json.Marshal(map[string]any{
		"mode":           "jd_match",
		"attemptId":      attJD,
		"jobDescription": "Staff Platform Engineer working on Go microservices, Cloud Run, and PostgreSQL 19.",
	})
	reqJD := httptest.NewRequest(http.MethodPost, "/v1/ask", bytes.NewReader(bodyJD))
	reqJD.Header.Set(internalauth.HeaderName, tokS2)
	recJD := httptest.NewRecorder()
	h.ServeHTTP(recJD, reqJD)
	storedJD, _, err := store.GetTurnByAttemptID(context.Background(), attJD, "session-s2")
	if err != nil {
		t.Fatalf("GetTurnByAttemptID jd_match: %v", err)
	}
	if !strings.Contains(storedJD.PromptText, "Staff Platform Engineer") {
		t.Fatalf("expected redacted non-empty prompt_text excerpt for jd_match, got %q", storedJD.PromptText)
	}
	_ = contracts.TurnStatusCompleted
}

func ActionAbortFallback() privacy.Action { return privacy.ActionAbort }
