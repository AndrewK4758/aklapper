package main

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/AndrewK4758/aklapper/packages/go/kit/llm"
	"github.com/AndrewK4758/aklapper/packages/go/kit/pg"
	"github.com/AndrewK4758/aklapper/packages/go/kit/qdrantseed"
)

func TestQdrantSeedCLIFlagsDryRunAndPartialFailure(t *testing.T) {
	t.Parallel()

	t.Run("dry-run validates cadence_patterns with zero Qdrant HTTP calls", func(t *testing.T) {
		var calls int
		qdrantSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			calls++
			w.WriteHeader(http.StatusOK)
		}))
		defer qdrantSrv.Close()

		var stdout, stderr bytes.Buffer
		code := runCLI(
			context.Background(),
			[]string{"--dry-run", "--", "--collections=cadence_patterns"},
			map[string]string{"QDRANT_URL": qdrantSrv.URL},
			&stdout,
			&stderr,
		)
		if code != 0 {
			t.Fatalf("expected exit 0, got %d; stderr=%s", code, stderr.String())
		}
		if calls != 0 {
			t.Fatalf("expected zero Qdrant requests in dry-run, got %d", calls)
		}
		if !strings.Contains(stdout.String(), "cadence_patterns") || strings.Contains(stdout.String(), "portfolio_docs") {
			t.Fatalf("expected only cadence_patterns in JSON summary, got %s", stdout.String())
		}

		var badOut, badErr bytes.Buffer
		if badCode := runCLI(context.Background(), []string{"unexpected-positional"}, nil, &badOut, &badErr); badCode != 1 {
			t.Fatalf("expected exit 1 on unexpected positional arg, got %d", badCode)
		}
	})

	t.Run("portfolio_docs requires live PG unless --skip-pg or PG_DISABLE_LIVE=true", func(t *testing.T) {
		var stdout, stderr bytes.Buffer
		code := runCLI(
			context.Background(),
			[]string{"--collections=portfolio_docs"},
			map[string]string{
				"DATABASE_URL": "postgres://postgres:postgres@127.0.0.1:1/aklapper?sslmode=disable",
				"QDRANT_URL":   "http://127.0.0.1:1",
			},
			&stdout,
			&stderr,
		)
		if code != 1 {
			t.Fatalf("expected exit 1 when PG is unreachable, got %d", code)
		}
		if !strings.Contains(stderr.String(), "postgres") && !strings.Contains(stderr.String(), "pg") {
			t.Fatalf("expected actionable PG error on stderr, got %s", stderr.String())
		}
	})

	t.Run("partial cross-collection failure reports failing collection and exits 1", func(t *testing.T) {
		llmSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path == "/v1/embeddings" {
				vec := make([]float32, 768)
				vec[0] = 0.25
				_ = json.NewEncoder(w).Encode(map[string]any{
					"data": []map[string]any{{"embedding": vec}},
				})
				return
			}
			http.NotFound(w, r)
		}))
		defer llmSrv.Close()

		qdrantSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			switch {
			case r.Method == http.MethodPut && r.URL.Path == "/collections/cadence_patterns":
				_ = json.NewEncoder(w).Encode(map[string]any{"result": true})
			case r.Method == http.MethodGet && r.URL.Path == "/collections/cadence_patterns":
				_ = json.NewEncoder(w).Encode(map[string]any{
					"result": map[string]any{
						"status":       "green",
						"points_count": 0,
						"config":       map[string]any{"params": map[string]any{"vectors": map[string]any{"size": 768, "distance": "Cosine"}}},
					},
				})
			case r.Method == http.MethodPut && r.URL.Path == "/collections/cadence_patterns/points":
				_ = json.NewEncoder(w).Encode(map[string]any{"status": "ok"})
			case r.Method == http.MethodPost && r.URL.Path == "/collections/cadence_patterns/points/scroll":
				_ = json.NewEncoder(w).Encode(map[string]any{"result": map[string]any{"points": []any{}, "next_page_offset": nil}})
			case r.Method == http.MethodPut && r.URL.Path == "/collections/portfolio_docs":
				_ = json.NewEncoder(w).Encode(map[string]any{"result": true})
			case r.Method == http.MethodGet && r.URL.Path == "/collections/portfolio_docs":
				_ = json.NewEncoder(w).Encode(map[string]any{
					"result": map[string]any{
						"status":       "green",
						"points_count": 0,
						"config":       map[string]any{"params": map[string]any{"vectors": map[string]any{"size": 768, "distance": "Cosine"}}},
					},
				})
			case r.Method == http.MethodPut && r.URL.Path == "/collections/portfolio_docs/points":
				http.Error(w, "upstream unavailable", http.StatusServiceUnavailable)
			default:
				http.NotFound(w, r)
			}
		}))
		defer qdrantSrv.Close()

		var stdout, stderr bytes.Buffer
		code := runCLI(
			context.Background(),
			[]string{"--collections=all", "--skip-pg"},
			map[string]string{
				"LOCAL_LLM_BASE_URL": llmSrv.URL + "/v1",
				"QDRANT_URL":         qdrantSrv.URL,
			},
			&stdout,
			&stderr,
		)
		if code != 1 {
			t.Fatalf("expected exit 1 on partial collection failure, got %d; stdout=%s stderr=%s", code, stdout.String(), stderr.String())
		}
		if !strings.Contains(stderr.String(), "portfolio_docs") || !strings.Contains(stderr.String(), "503") {
			t.Fatalf("expected portfolio_docs + 503 diagnostic on stderr, got %s", stderr.String())
		}
	})

	t.Run("providerFromEnvMap delegates to llm.NewFromEnvMap defaults and curated corpora reflect upgraded models", func(t *testing.T) {
		prov, ok := providerFromEnvMap(map[string]string{
			"AI_PROVIDER":    "vertex",
			"GCP_PROJECT_ID": "games-424800",
		}).(*llm.VertexClient)
		if !ok {
			t.Fatal("expected *llm.VertexClient")
		}
		if prov.Location != "global" || prov.Model != "gemini-3.8-flash" || prov.EmbedModel != "gemini-embedding-2" || prov.ThinkingLevel != "LOW" {
			t.Fatalf("unexpected Vertex defaults from providerFromEnvMap: %+v", prov)
		}

		for _, doc := range pg.CuratedPortfolioDocs() {
			if strings.Contains(doc.Snippet, "text-embedding-005") {
				t.Fatalf("stale text-embedding-005 reference in pg curated doc %q", doc.ID)
			}
		}
		for _, doc := range qdrantseed.CuratedPortfolioDocs() {
			if strings.Contains(doc.Body, "text-embedding-005") {
				t.Fatalf("stale text-embedding-005 reference in qdrantseed curated doc %q", doc.ID)
			}
		}
	})
}
