package main

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
	"github.com/AndrewK4758/aklapper/packages/go/kit/internalauth"
	"github.com/AndrewK4758/aklapper/packages/go/kit/llm"
	"github.com/AndrewK4758/aklapper/packages/go/kit/pg"
	"github.com/AndrewK4758/aklapper/packages/go/kit/qdrant"
)

type stubBuildLLM struct {
	html      string
	err       error
	embedWait time.Duration
	chatCalls atomic.Int32
}

func (s *stubBuildLLM) Name() string { return "stub-builder" }
func (s *stubBuildLLM) Embed(ctx context.Context, _ string) ([]float32, error) {
	if s.embedWait > 0 {
		select {
		case <-time.After(s.embedWait):
		case <-ctx.Done():
			return nil, ctx.Err()
		}
	}
	return []float32{0.1, 0.2}, nil
}
func (s *stubBuildLLM) Chat(_ context.Context, _ []llm.ChatMessage, _ int) (llm.Completion, error) {
	s.chatCalls.Add(1)
	if s.err != nil {
		return llm.Completion{}, s.err
	}
	return llm.Completion{Text: s.html, Model: "stub", TokensUsed: 250}, nil
}

type sseFrame struct {
	Event string
	Data  string
}

func parseSSEFrames(raw string) []sseFrame {
	scanner := bufio.NewScanner(strings.NewReader(raw))
	var frames []sseFrame
	var curEvent, curData string
	for scanner.Scan() {
		line := scanner.Text()
		if line == "" {
			if curEvent != "" || curData != "" {
				frames = append(frames, sseFrame{Event: curEvent, Data: curData})
				curEvent = ""
				curData = ""
			}
			continue
		}
		if after, ok := strings.CutPrefix(line, "event: "); ok {
			curEvent = after
		} else if after, ok := strings.CutPrefix(line, "data: "); ok {
			curData = after
		}
	}
	if curEvent != "" || curData != "" {
		frames = append(frames, sseFrame{Event: curEvent, Data: curData})
	}
	return frames
}

func TestCadenceDemoUnitFlows(t *testing.T) {
	t.Setenv("INTERNAL_AUTH_SECRET", "cadence-demo-unit-secret")
	guestTok, err := internalauth.Sign(internalauth.RoleGuest, "unit-sess-1", time.Minute, "cadence-demo-unit-secret")
	if err != nil {
		t.Fatalf("sign guest token: %v", err)
	}

	store := pg.NewMemoryStore()
	store.SetPolicyForTest(pg.QuotaPolicy{
		Role:                 contracts.RoleGuest,
		MaxTurnsPerSession:   2,
		MaxTokensPerRun:      4000,
		MaxDailyGlobalTokens: 100000,
	})

	unsafeLLM := &stubBuildLLM{
		html: `<!doctype html><html><body><iframe src="https://evil.test"></iframe><script>top.location='https://evil.test'; document.cookie;</script><p>Safe</p></body></html>`,
	}
	h := newHandler(unsafeLLM, &qdrant.Client{BaseURL: "http://127.0.0.1:1"}, store)

	t.Run("rejects unauthenticated callers and non-admin cross-session listing", func(t *testing.T) {
		recListUnauth := httptest.NewRecorder()
		h.ServeHTTP(recListUnauth, httptest.NewRequest(http.MethodGet, "/v1/cadence/runs?limit=50", nil))
		if recListUnauth.Code != http.StatusUnauthorized {
			t.Fatalf("expected 401 for unauthenticated list, got %d", recListUnauth.Code)
		}

		reqNoSession := httptest.NewRequest(http.MethodGet, "/v1/cadence/runs?limit=50", nil)
		reqNoSession.Header.Set(internalauth.HeaderName, guestTok)
		recNoSession := httptest.NewRecorder()
		h.ServeHTTP(recNoSession, reqNoSession)
		if recNoSession.Code != http.StatusBadRequest {
			t.Fatalf("expected 400 for guest list omitting sessionId, got %d", recNoSession.Code)
		}

		recCreateUnauth := httptest.NewRecorder()
		h.ServeHTTP(recCreateUnauth, httptest.NewRequest(http.MethodPost, "/v1/cadence/runs", bytes.NewReader([]byte(`{"prompt":"Build telemetry"}`))))
		if recCreateUnauth.Code != http.StatusUnauthorized {
			t.Fatalf("expected 401 for unauthenticated run creation, got %d", recCreateUnauth.Code)
		}
	})

	var createdRunID string
	t.Run("POST /v1/cadence/runs executes 4 CHORD turns and sanitizes artifact", func(t *testing.T) {
		body := []byte(`{"prompt":"Build a telemetry monitor card","presetSlug":"solar-forge-starter","sessionId":"unit-sess-1"}`)
		req := httptest.NewRequest(http.MethodPost, "/v1/cadence/runs", bytes.NewReader(body))
		req.Header.Set(internalauth.HeaderName, guestTok)
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		if rec.Code != http.StatusCreated {
			t.Fatalf("expected 201, got %d: %s", rec.Code, rec.Body.String())
		}
		var out struct {
			RunID        string                  `json:"runId"`
			GateVerdict  string                  `json:"gateVerdict"`
			Turns        []contracts.CadenceTurn `json:"turns"`
			ArtifactHTML string                  `json:"artifactHtml"`
			Quota        contracts.QuotaStatus   `json:"quota"`
		}
		if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
			t.Fatalf("decode: %v", err)
		}
		createdRunID = out.RunID
		if len(out.Turns) != 4 {
			t.Fatalf("expected 4 CHORD turns, got %d", len(out.Turns))
		}
		phases := []string{out.Turns[0].Phase, out.Turns[1].Phase, out.Turns[2].Phase, out.Turns[3].Phase}
		if strings.Join(phases, ",") != "triage,spec,build,gate" {
			t.Fatalf("unexpected phases: %v", phases)
		}
		if strings.Contains(out.ArtifactHTML, "<iframe") || strings.Contains(out.ArtifactHTML, "top.location") || strings.Contains(out.ArtifactHTML, "document.cookie") {
			t.Fatalf("expected sanitizer to neutralize unsafe tags/escape hatches, got: %s", out.ArtifactHTML)
		}
		if out.Quota.TurnsUsed != 1 || out.Quota.MaxTurns != 2 {
			t.Fatalf("unexpected quota: %+v", out.Quota)
		}
	})

	t.Run("POST /v1/cadence/runs/{id}/gate requires internal auth, binds claims.Sub when X-Session-Id omitted, updates verdict, and rejects invalid verdict", func(t *testing.T) {
		recGateUnauth := httptest.NewRecorder()
		h.ServeHTTP(recGateUnauth, httptest.NewRequest(http.MethodPost, "/v1/cadence/runs/"+createdRunID+"/gate", bytes.NewReader([]byte(`{"verdict":"approved"}`))))
		if recGateUnauth.Code != http.StatusUnauthorized {
			t.Fatalf("expected 401 for unauthenticated gate update, got %d", recGateUnauth.Code)
		}

		// Mismatched X-Session-Id vs HMAC claims.Sub fails closed with 403.
		reqMismatch := httptest.NewRequest(http.MethodPost, "/v1/cadence/runs/"+createdRunID+"/gate", bytes.NewReader([]byte(`{"verdict":"approved"}`)))
		reqMismatch.Header.Set(internalauth.HeaderName, guestTok)
		reqMismatch.Header.Set("X-Session-Id", "other-session")
		recMismatch := httptest.NewRecorder()
		h.ServeHTTP(recMismatch, reqMismatch)
		if recMismatch.Code != http.StatusForbidden {
			t.Fatalf("expected 403 when X-Session-Id mismatches claims.Sub, got %d", recMismatch.Code)
		}

		// Omitting X-Session-Id binds ownership strictly to claims.Sub and rejects invalid verdict with 400.
		reqBad := httptest.NewRequest(http.MethodPost, "/v1/cadence/runs/"+createdRunID+"/gate", bytes.NewReader([]byte(`{"verdict":"maybe"}`)))
		reqBad.Header.Set(internalauth.HeaderName, guestTok)
		recBad := httptest.NewRecorder()
		h.ServeHTTP(recBad, reqBad)
		if recBad.Code != http.StatusBadRequest {
			t.Fatalf("expected 400 for invalid verdict, got %d", recBad.Code)
		}

		reqOK := httptest.NewRequest(http.MethodPost, "/v1/cadence/runs/"+createdRunID+"/gate", bytes.NewReader([]byte(`{"verdict":"approved"}`)))
		reqOK.Header.Set(internalauth.HeaderName, guestTok)
		reqOK.Header.Set("X-Session-Id", "unit-sess-1")
		recOK := httptest.NewRecorder()
		h.ServeHTTP(recOK, reqOK)
		if recOK.Code != http.StatusOK || !strings.Contains(recOK.Body.String(), `"gateVerdict":"approved"`) {
			t.Fatalf("expected 200 approved, got (%d): %s", recOK.Code, recOK.Body.String())
		}
	})

	t.Run("GET /v1/cadence/runs returns session-scoped history", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/v1/cadence/runs?sessionId=unit-sess-1", nil)
		req.Header.Set(internalauth.HeaderName, guestTok)
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", rec.Code)
		}
		var out struct {
			Runs []pg.SandboxRun `json:"runs"`
		}
		_ = json.Unmarshal(rec.Body.Bytes(), &out)
		if len(out.Runs) != 1 || out.Runs[0].GateVerdict != "approved" {
			t.Fatalf("unexpected runs list: %+v", out.Runs)
		}
	})

	t.Run("POST /v1/cadence/runs returns 429 when quota is exhausted", func(t *testing.T) {
		// 2nd run succeeds
		req2 := httptest.NewRequest(http.MethodPost, "/v1/cadence/runs", bytes.NewReader([]byte(`{"prompt":"Second turn prompt","sessionId":"unit-sess-1"}`)))
		req2.Header.Set(internalauth.HeaderName, guestTok)
		rec2 := httptest.NewRecorder()
		h.ServeHTTP(rec2, req2)
		if rec2.Code != http.StatusCreated {
			t.Fatalf("expected 201 on 2nd run, got %d", rec2.Code)
		}
		// 3rd run fails closed with 429
		req3 := httptest.NewRequest(http.MethodPost, "/v1/cadence/runs", bytes.NewReader([]byte(`{"prompt":"Third turn prompt","sessionId":"unit-sess-1"}`)))
		req3.Header.Set(internalauth.HeaderName, guestTok)
		rec3 := httptest.NewRecorder()
		h.ServeHTTP(rec3, req3)
		if rec3.Code != http.StatusTooManyRequests {
			t.Fatalf("expected 429 on 3rd run, got %d", rec3.Code)
		}
	})

	t.Run("POST /v1/cadence/runs recalls seeded cadence_patterns into spec turn payload", func(t *testing.T) {
		qdrantSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Method == http.MethodPost && r.URL.Path == "/collections/cadence_patterns/points/search" {
				_ = json.NewEncoder(w).Encode(map[string]any{
					"result": []map[string]any{
						{
							"id":    qdrant.CollectionPointID("cadence_patterns", "pattern-solar-forge-telemetry"),
							"score": 0.91,
							"payload": map[string]any{
								"docId":      "pattern-solar-forge-telemetry",
								"title":      "Solar Forge Telemetry Card",
								"summary":    "Telemetry widget pattern",
								"category":   "telemetry",
								"chordPhase": "build",
								"source":     "curated",
							},
						},
					},
				})
				return
			}
			http.NotFound(w, r)
		}))
		defer qdrantSrv.Close()

		fallbackLLM := &stubBuildLLM{html: "not-html-uses-deterministic-starter"}
		hRecall := newHandler(fallbackLLM, &qdrant.Client{BaseURL: qdrantSrv.URL, HTTPClient: qdrantSrv.Client()}, pg.NewMemoryStore())
		recallTok, _ := internalauth.Sign(internalauth.RoleGuest, "recall-sess-1", time.Minute, "cadence-demo-unit-secret")
		req := httptest.NewRequest(http.MethodPost, "/v1/cadence/runs", bytes.NewReader([]byte(`{"prompt":"Build a telemetry monitor widget","sessionId":"recall-sess-1"}`)))
		req.Header.Set(internalauth.HeaderName, recallTok)
		rec := httptest.NewRecorder()
		hRecall.ServeHTTP(rec, req)
		if rec.Code != http.StatusCreated {
			t.Fatalf("expected 201, got %d: %s", rec.Code, rec.Body.String())
		}
		var out struct {
			Turns        []contracts.CadenceTurn `json:"turns"`
			ArtifactHTML string                  `json:"artifactHtml"`
		}
		if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
			t.Fatalf("decode: %v", err)
		}
		if len(out.Turns) != 4 || out.Turns[1].Phase != "spec" {
			t.Fatalf("unexpected turns: %+v", out.Turns)
		}
		rawPatterns, ok := out.Turns[1].Payload["recalledPatterns"].([]any)
		if !ok || len(rawPatterns) != 1 || rawPatterns[0] != "Solar Forge Telemetry Card" {
			t.Fatalf("expected recalledPatterns=[Solar Forge Telemetry Card], got %#v", out.Turns[1].Payload["recalledPatterns"])
		}
		if !strings.Contains(out.ArtifactHTML, "Solar Forge Telemetry Card") {
			t.Fatalf("expected starter artifact HTML to cite recalled pattern, got %s", out.ArtifactHTML)
		}
	})
}

func TestCadenceDemoFastStreamingAndSecurity(t *testing.T) {
	t.Setenv("INTERNAL_AUTH_SECRET", "cadence-demo-stream-secret")
	guestTok, err := internalauth.Sign(internalauth.RoleGuest, "fast-sess-1", time.Minute, "cadence-demo-stream-secret")
	if err != nil {
		t.Fatalf("sign guest token: %v", err)
	}

	store := pg.NewMemoryStore()
	store.SetPolicyForTest(pg.QuotaPolicy{
		Role:                 contracts.RoleGuest,
		MaxTurnsPerSession:   10,
		MaxTokensPerRun:      4000,
		MaxDailyGlobalTokens: 100000,
	})

	slowEmbedLLM := &stubBuildLLM{
		html:      `<!doctype html><html><body><p>LLM Built</p></body></html>`,
		embedWait: 600 * time.Millisecond,
	}
	h := newHandler(slowEmbedLLM, &qdrant.Client{BaseURL: "http://127.0.0.1:1"}, store)

	t.Run("rejects unrecognized mode with 400", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/v1/cadence/runs", bytes.NewReader([]byte(`{"prompt":"Check latency metrics","mode":"turbo","deferExecution":true}`)))
		req.Header.Set(internalauth.HeaderName, guestTok)
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("expected 400 for invalid mode, got %d", rec.Code)
		}
	})

	var deferredRunID string
	t.Run("deferExecution fast mode returns 202 and streams SSE phases bypassing provider Chat", func(t *testing.T) {
		initBody := `{"prompt":"Monitor <script>alert(1)</script> CHORD latency and replica probes","presetSlug":"chord-pipeline-monitor","sessionId":"fast-sess-1","mode":"fast","deferExecution":true}`
		req := httptest.NewRequest(http.MethodPost, "/v1/cadence/runs", bytes.NewReader([]byte(initBody)))
		req.Header.Set(internalauth.HeaderName, guestTok)
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		if rec.Code != http.StatusAccepted {
			t.Fatalf("expected 202 Accepted, got %d: %s", rec.Code, rec.Body.String())
		}

		var initRun contracts.CadenceRunResult
		if err := json.Unmarshal(rec.Body.Bytes(), &initRun); err != nil {
			t.Fatalf("decode 202 body: %v", err)
		}
		if initRun.RunStatus != contracts.CadenceStatusPending || initRun.Mode != contracts.CadenceModeFast || initRun.PresetSlug != "chord-pipeline-monitor" || len(initRun.Turns) != 4 {
			t.Fatalf("unexpected 202 contract payload: %+v", initRun)
		}
		deferredRunID = initRun.RunID

		// Premature gate verdict rejected with 409 Conflict.
		gateEarlyReq := httptest.NewRequest(http.MethodPost, "/v1/cadence/runs/"+deferredRunID+"/gate", bytes.NewReader([]byte(`{"verdict":"approved"}`)))
		gateEarlyReq.Header.Set(internalauth.HeaderName, guestTok)
		gateEarlyReq.Header.Set("X-Session-Id", "fast-sess-1")
		gateEarlyRec := httptest.NewRecorder()
		h.ServeHTTP(gateEarlyRec, gateEarlyReq)
		if gateEarlyRec.Code != http.StatusConflict {
			t.Fatalf("expected 409 for gate on pending run, got %d: %s", gateEarlyRec.Code, gateEarlyRec.Body.String())
		}

		// Stream auth and ownership checks before opening SSE.
		unauthTokenReq := httptest.NewRequest(http.MethodGet, "/v1/cadence/runs/"+deferredRunID+"/stream", nil)
		unauthTokenReq.Header.Set("X-Session-Id", "fast-sess-1")
		unauthTokenRec := httptest.NewRecorder()
		h.ServeHTTP(unauthTokenRec, unauthTokenReq)
		if unauthTokenRec.Code != http.StatusUnauthorized {
			t.Fatalf("expected 401 when internal auth missing on stream, got %d", unauthTokenRec.Code)
		}

		badIDReq := httptest.NewRequest(http.MethodGet, "/v1/cadence/runs/not-a-uuid/stream", nil)
		badIDReq.Header.Set(internalauth.HeaderName, guestTok)
		badIDReq.Header.Set("X-Session-Id", "fast-sess-1")
		badIDRec := httptest.NewRecorder()
		h.ServeHTTP(badIDRec, badIDReq)
		if badIDRec.Code != http.StatusBadRequest {
			t.Fatalf("expected 400 for non-UUID stream id, got %d", badIDRec.Code)
		}

		wrongSessReq := httptest.NewRequest(http.MethodGet, "/v1/cadence/runs/"+deferredRunID+"/stream", nil)
		wrongSessReq.Header.Set(internalauth.HeaderName, guestTok)
		wrongSessReq.Header.Set("X-Session-Id", "other-session")
		wrongSessRec := httptest.NewRecorder()
		h.ServeHTTP(wrongSessRec, wrongSessReq)
		if wrongSessRec.Code != http.StatusForbidden {
			t.Fatalf("expected 403 for cross-session stream request, got %d", wrongSessRec.Code)
		}

		// Execute live fast stream (caps embed at 250ms, skips Chat, omits Connection: keep-alive).
		start := time.Now()
		streamReq := httptest.NewRequest(http.MethodGet, "/v1/cadence/runs/"+deferredRunID+"/stream", nil)
		streamReq.Header.Set(internalauth.HeaderName, guestTok)
		streamReq.Header.Set("X-Session-Id", "fast-sess-1")
		streamRec := httptest.NewRecorder()
		h.ServeHTTP(streamRec, streamReq)
		elapsed := time.Since(start)
		if streamRec.Code != http.StatusOK {
			t.Fatalf("expected 200 SSE stream, got %d: %s", streamRec.Code, streamRec.Body.String())
		}
		if gotConn := streamRec.Header().Get("Connection"); gotConn != "" {
			t.Fatalf("expected no Connection header on HTTP/2 SSE stream, got %q", gotConn)
		}
		if elapsed > 2*time.Second {
			t.Fatalf("expected fast stream to cap slow dependencies well under 2s, took %v", elapsed)
		}
		if slowEmbedLLM.chatCalls.Load() != 0 {
			t.Fatalf("expected fast mode to bypass provider Chat, got %d calls", slowEmbedLLM.chatCalls.Load())
		}

		frames := parseSSEFrames(streamRec.Body.String())
		var phaseEvents int
		var completed contracts.CadenceStreamCompleteEvent
		for _, f := range frames {
			if f.Event == "phase" {
				phaseEvents++
			}
			if f.Event == "complete" {
				if err := json.Unmarshal([]byte(f.Data), &completed); err != nil {
					t.Fatalf("decode complete event: %v", err)
				}
			}
		}
		if phaseEvents < 4 || completed.Run.RunStatus != contracts.CadenceStatusReady {
			t.Fatalf("expected >=4 phase events and complete ready run, got phases=%d complete=%+v", phaseEvents, completed)
		}
		if !strings.Contains(completed.Run.ArtifactHTML, "&lt;script&gt;alert(1)&lt;/script&gt;") || !strings.Contains(completed.Run.ArtifactHTML, "chord-pipeline-monitor") {
			t.Fatalf("expected tailored escaped artifactHtml, got: %s", completed.Run.ArtifactHTML)
		}

		// Replay on ready run serves persisted complete event without charging quota or calling LLM.
		replayReq := httptest.NewRequest(http.MethodGet, "/v1/cadence/runs/"+deferredRunID+"/stream", nil)
		replayReq.Header.Set(internalauth.HeaderName, guestTok)
		replayReq.Header.Set("X-Session-Id", "fast-sess-1")
		replayRec := httptest.NewRecorder()
		h.ServeHTTP(replayRec, replayReq)
		if replayRec.Code != http.StatusOK || !strings.Contains(replayRec.Body.String(), "event: complete") {
			t.Fatalf("expected ready replay complete event, got (%d): %s", replayRec.Code, replayRec.Body.String())
		}
		quota, _ := store.GetQuotaStatus(context.Background(), contracts.RoleGuest, "fast-sess-1")
		if quota.TurnsUsed != 1 {
			t.Fatalf("expected replay not to double-charge quota, turnsUsed=%d", quota.TurnsUsed)
		}

		// Gate enforces X-Session-Id when present and returns contracts.CadenceRunResult shape.
		gateWrongReq := httptest.NewRequest(http.MethodPost, "/v1/cadence/runs/"+deferredRunID+"/gate", bytes.NewReader([]byte(`{"verdict":"approved"}`)))
		gateWrongReq.Header.Set(internalauth.HeaderName, guestTok)
		gateWrongReq.Header.Set("X-Session-Id", "other-session")
		gateWrongRec := httptest.NewRecorder()
		h.ServeHTTP(gateWrongRec, gateWrongReq)
		if gateWrongRec.Code != http.StatusForbidden {
			t.Fatalf("expected 403 for cross-session gate verdict, got %d", gateWrongRec.Code)
		}

		gateOKReq := httptest.NewRequest(http.MethodPost, "/v1/cadence/runs/"+deferredRunID+"/gate", bytes.NewReader([]byte(`{"verdict":"approved"}`)))
		gateOKReq.Header.Set(internalauth.HeaderName, guestTok)
		gateOKReq.Header.Set("X-Session-Id", "fast-sess-1")
		gateOKRec := httptest.NewRecorder()
		h.ServeHTTP(gateOKRec, gateOKReq)
		if gateOKRec.Code != http.StatusOK {
			t.Fatalf("expected 200 gate verdict, got %d: %s", gateOKRec.Code, gateOKRec.Body.String())
		}
		var gateOut struct {
			Run contracts.CadenceRunResult `json:"run"`
		}
		if err := json.Unmarshal(gateOKRec.Body.Bytes(), &gateOut); err != nil {
			t.Fatalf("decode gate response: %v", err)
		}
		if gateOut.Run.RunStatus != contracts.CadenceStatusReady || gateOut.Run.PresetSlug != "chord-pipeline-monitor" || gateOut.Run.Mode != contracts.CadenceModeFast || gateOut.Run.GateVerdict != "approved" {
			t.Fatalf("unexpected contracts.CadenceRunResult in gate response: %+v", gateOut.Run)
		}
	})

	t.Run("optional llm mode invokes provider Chat and concurrent streams execute at most once", func(t *testing.T) {
		llmTok, _ := internalauth.Sign(internalauth.RoleGuest, "llm-sess-1", time.Minute, "cadence-demo-stream-secret")
		llmInitReq := httptest.NewRequest(http.MethodPost, "/v1/cadence/runs", bytes.NewReader([]byte(`{"prompt":"Generate custom LLM mode panel","presetSlug":"custom","sessionId":"llm-sess-1","mode":"llm","deferExecution":true}`)))
		llmInitReq.Header.Set(internalauth.HeaderName, llmTok)
		llmInitRec := httptest.NewRecorder()
		h.ServeHTTP(llmInitRec, llmInitReq)
		if llmInitRec.Code != http.StatusAccepted {
			t.Fatalf("expected 202, got %d", llmInitRec.Code)
		}
		var llmInit contracts.CadenceRunResult
		_ = json.Unmarshal(llmInitRec.Body.Bytes(), &llmInit)

		var wg sync.WaitGroup
		for range 2 {
			wg.Add(1)
			go func() {
				defer wg.Done()
				req := httptest.NewRequest(http.MethodGet, "/v1/cadence/runs/"+llmInit.RunID+"/stream", nil)
				req.Header.Set(internalauth.HeaderName, llmTok)
				req.Header.Set("X-Session-Id", "llm-sess-1")
				rec := httptest.NewRecorder()
				h.ServeHTTP(rec, req)
				if rec.Code != http.StatusOK {
					t.Errorf("concurrent stream failed: %d", rec.Code)
				}
			}()
		}
		wg.Wait()

		if slowEmbedLLM.chatCalls.Load() != 2 {
			t.Fatalf("expected exactly 2 Chat invocations (Spec + Build) across concurrent streams, got %d", slowEmbedLLM.chatCalls.Load())
		}
	})

	t.Run("client context cancel during SSE stream does not strand run in running state", func(t *testing.T) {
		cancelTok, _ := internalauth.Sign(internalauth.RoleGuest, "cancel-sess-1", time.Minute, "cadence-demo-stream-secret")
		initReq := httptest.NewRequest(http.MethodPost, "/v1/cadence/runs", bytes.NewReader([]byte(`{"prompt":"Disconnect resilience stream check","presetSlug":"solar-forge-starter","sessionId":"cancel-sess-1","mode":"fast","deferExecution":true}`)))
		initReq.Header.Set(internalauth.HeaderName, cancelTok)
		initRec := httptest.NewRecorder()
		h.ServeHTTP(initRec, initReq)
		if initRec.Code != http.StatusAccepted {
			t.Fatalf("expected 202, got %d", initRec.Code)
		}
		var initRun contracts.CadenceRunResult
		_ = json.Unmarshal(initRec.Body.Bytes(), &initRun)

		cancelCtx, cancel := context.WithCancel(context.Background())
		streamReq := httptest.NewRequest(http.MethodGet, "/v1/cadence/runs/"+initRun.RunID+"/stream", nil).WithContext(cancelCtx)
		streamReq.Header.Set(internalauth.HeaderName, cancelTok)
		streamReq.Header.Set("X-Session-Id", "cancel-sess-1")
		cancel()

		streamRec := httptest.NewRecorder()
		h.ServeHTTP(streamRec, streamReq)

		saved, err := store.GetSandboxRun(context.Background(), initRun.RunID)
		if err != nil || saved.Status != contracts.CadenceStatusReady {
			t.Fatalf("expected run to complete to ready despite client cancel, got status=%q err=%v", saved.Status, err)
		}
	})

	t.Run("executeChordSteps propagates UpdateSandboxTurn errors instead of swallowing them", func(t *testing.T) {
		_, err := executeChordSteps(
			context.Background(),
			nil,
			nil,
			store,
			"00000000-0000-4000-8000-999999999999",
			"Missing run id should return turn update error",
			"solar-forge-starter",
			contracts.CadenceModeFast,
			nil,
		)
		if err == nil {
			t.Fatal("expected executeChordSteps to return UpdateSandboxTurn error for unknown runID")
		}
	})
}
