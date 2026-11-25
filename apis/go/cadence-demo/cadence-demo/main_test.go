package main

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
	"github.com/AndrewK4758/aklapper/packages/go/kit/llm"
	"github.com/AndrewK4758/aklapper/packages/go/kit/pg"
	"github.com/AndrewK4758/aklapper/packages/go/kit/qdrant"
)

type stubBuildLLM struct {
	html string
	err  error
}

func (s *stubBuildLLM) Name() string { return "stub-builder" }
func (s *stubBuildLLM) Embed(_ context.Context, _ string) ([]float32, error) {
	return []float32{0.1, 0.2}, nil
}
func (s *stubBuildLLM) Chat(_ context.Context, _ []llm.ChatMessage, _ int) (llm.Completion, error) {
	if s.err != nil {
		return llm.Completion{}, s.err
	}
	return llm.Completion{Text: s.html, Model: "stub", TokensUsed: 250}, nil
}

func TestCadenceDemoUnitFlows(t *testing.T) {
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

	var createdRunID string
	t.Run("POST /v1/cadence/runs executes 4 CHORD turns and sanitizes artifact", func(t *testing.T) {
		body := []byte(`{"prompt":"Build a telemetry monitor card","presetSlug":"solar-forge-starter","sessionId":"unit-sess-1"}`)
		req := httptest.NewRequest(http.MethodPost, "/v1/cadence/runs", bytes.NewReader(body))
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

	t.Run("POST /v1/cadence/runs/{id}/gate updates verdict and rejects invalid verdict", func(t *testing.T) {
		reqBad := httptest.NewRequest(http.MethodPost, "/v1/cadence/runs/"+createdRunID+"/gate", bytes.NewReader([]byte(`{"verdict":"maybe"}`)))
		recBad := httptest.NewRecorder()
		h.ServeHTTP(recBad, reqBad)
		if recBad.Code != http.StatusBadRequest {
			t.Fatalf("expected 400 for invalid verdict, got %d", recBad.Code)
		}

		reqOK := httptest.NewRequest(http.MethodPost, "/v1/cadence/runs/"+createdRunID+"/gate", bytes.NewReader([]byte(`{"verdict":"approved"}`)))
		recOK := httptest.NewRecorder()
		h.ServeHTTP(recOK, reqOK)
		if recOK.Code != http.StatusOK || !strings.Contains(recOK.Body.String(), `"gateVerdict":"approved"`) {
			t.Fatalf("expected 200 approved, got (%d): %s", recOK.Code, recOK.Body.String())
		}
	})

	t.Run("GET /v1/cadence/runs returns session-scoped history", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/v1/cadence/runs?sessionId=unit-sess-1", nil)
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
		rec2 := httptest.NewRecorder()
		h.ServeHTTP(rec2, req2)
		if rec2.Code != http.StatusCreated {
			t.Fatalf("expected 201 on 2nd run, got %d", rec2.Code)
		}
		// 3rd run fails closed with 429
		req3 := httptest.NewRequest(http.MethodPost, "/v1/cadence/runs", bytes.NewReader([]byte(`{"prompt":"Third turn prompt","sessionId":"unit-sess-1"}`)))
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
		req := httptest.NewRequest(http.MethodPost, "/v1/cadence/runs", bytes.NewReader([]byte(`{"prompt":"Build a telemetry monitor widget","sessionId":"recall-sess-1"}`)))
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
