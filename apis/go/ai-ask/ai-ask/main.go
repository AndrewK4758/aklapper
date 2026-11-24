package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"

	"github.com/AndrewK4758/aklapper/packages/go/kit/httpkit"
	"github.com/AndrewK4758/aklapper/packages/go/kit/llm"
	"github.com/AndrewK4758/aklapper/packages/go/kit/qdrant"
)

type askRequest struct {
	Question string `json:"question"`
}

func newHandler(provider llm.Provider, vectorStore *qdrant.Client) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", httpkit.NewHealthHandler("ai-ask"))

	mux.HandleFunc("POST /v1/ask", func(w http.ResponseWriter, r *http.Request) {
		var req askRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			httpkit.WriteError(w, http.StatusBadRequest, "invalid JSON payload")
			return
		}
		q := strings.TrimSpace(req.Question)
		if len(q) < 4 || len(q) > 800 {
			httpkit.WriteError(w, http.StatusBadRequest, "question must be between 4 and 800 characters")
			return
		}

		vec, err := provider.Embed(r.Context(), q)
		if err != nil {
			httpkit.WriteJSON(w, http.StatusOK, map[string]any{
				"grounded": false,
				"provider": provider.Name(),
				"answer":   "Abstaining: local/prod embedding provider is unavailable right now.",
				"sources":  []any{},
			})
			return
		}

		hits, err := vectorStore.Search(r.Context(), "portfolio_docs", vec, 4)
		if err != nil || len(hits) == 0 {
			httpkit.WriteJSON(w, http.StatusOK, map[string]any{
				"grounded": false,
				"provider": provider.Name(),
				"answer":   "Abstaining: no grounded portfolio evidence matched your question.",
				"sources":  []any{},
			})
			return
		}

		var ctxBuilder strings.Builder
		sources := make([]string, 0, len(hits))
		for i, hit := range hits {
			title, _ := hit.Payload["title"].(string)
			snippet, _ := hit.Payload["snippet"].(string)
			sources = append(sources, title)
			fmt.Fprintf(&ctxBuilder, "[%d] %s: %s\n", i+1, title, snippet)
		}

		completion, err := provider.Chat(r.Context(), []llm.ChatMessage{
			{
				Role:    "system",
				Content: "Answer strictly from the provided portfolio evidence. If evidence is insufficient, abstain.",
			},
			{
				Role:    "user",
				Content: fmt.Sprintf("Evidence:\n%s\nQuestion: %s", ctxBuilder.String(), q),
			},
		}, 384)
		if err != nil {
			httpkit.WriteError(w, http.StatusBadGateway, "llm inference failed")
			return
		}

		httpkit.WriteJSON(w, http.StatusOK, map[string]any{
			"grounded":   true,
			"provider":   provider.Name(),
			"model":      completion.Model,
			"tokensUsed": completion.TokensUsed,
			"answer":     completion.Text,
			"sources":    sources,
		})
	})

	return mux
}

func main() {
	addr := httpkit.ListenAddr("8083")
	log.Printf("ai-ask listening on %s", addr)
	if err := httpkit.ListenAndServeGraceful(addr, newHandler(llm.NewFromEnv(), qdrant.NewFromEnv())); err != nil {
		log.Fatal(err)
	}
}
