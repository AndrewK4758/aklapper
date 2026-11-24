package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"net/http"
	"regexp"
	"strings"

	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
	"github.com/AndrewK4758/aklapper/packages/go/kit/httpkit"
	"github.com/AndrewK4758/aklapper/packages/go/kit/internalauth"
	"github.com/AndrewK4758/aklapper/packages/go/kit/llm"
	"github.com/AndrewK4758/aklapper/packages/go/kit/pg"
	"github.com/AndrewK4758/aklapper/packages/go/kit/qdrant"
)

const (
	portfolioCollection = "portfolio_docs"
	minGroundScore      = 0.35
)

type askRequest struct {
	Mode           string `json:"mode"`
	Question       string `json:"question"`
	JobDescription string `json:"jobDescription"`
	SessionID      string `json:"sessionId"`
	Role           string `json:"role"`
}

type askResponse struct {
	Grounded   bool                   `json:"grounded"`
	Mode       string                 `json:"mode"`
	Provider   string                 `json:"provider"`
	Model      string                 `json:"model,omitempty"`
	TokensUsed int                    `json:"tokensUsed"`
	Answer     string                 `json:"answer"`
	Sources    []contracts.AskSource  `json:"sources"`
	MatchScore *int                   `json:"matchScore,omitempty"`
	Strengths  []string               `json:"strengths,omitempty"`
	Gaps       []string               `json:"gaps,omitempty"`
	Quota      *contracts.QuotaStatus `json:"quota,omitempty"`
}

var tokenRegex = regexp.MustCompile(`[a-z0-9][a-z0-9+#.-]{2,}`)

var curatedSummaryDocs = []pg.CorpusDocument{
	{
		ID:       "curated:architecture",
		Title:    "Portfolio Architecture // Cloud Run SSR + GKE Scale-to-Zero Go",
		Snippet:  "Andrew Klapper's Solar Forge v2 portfolio pairs React 19 + React Router 8 + Fastify 5 SSR on Cloud Run with scale-from-zero distroless Go microservices on GKE Autopilot, PostgreSQL 19, Qdrant cosine vector search, and strict 4-layer CSS tokens.",
		Category: "architecture",
		Source:   "curated",
	},
	{
		ID:       "curated:cadence-sandbox",
		Title:    "CADENCE CHORD Sandbox // Security & Quota Guardrails",
		Snippet:  "The CADENCE Builder runs a 4-phase CHORD pipeline (triage, spec, build, gate) persisted to PostgreSQL 19 sandbox_runs and sandbox_turns, enforcing transactional session/daily quotas, HTML sanitization, and an iframe strictly sandboxed with allow-scripts without allow-same-origin.",
		Category: "security",
		Source:   "curated",
	},
	{
		ID:       "curated:ai-rag",
		Title:    "Grounded AI Retrieval // Vertex AI + Local Llama-Swap + Qdrant",
		Snippet:  "Unified Node and Go LLM providers support local llama-swap on :11434 and live Google Cloud Vertex AI REST/ADC endpoints, paired with Qdrant cosine similarity thresholds and strict fail-closed abstention when evidence is missing or weak.",
		Category: "ai",
		Source:   "curated",
	},
}

func curatedJDKeywords() []string {
	return []string{
		"golang", "go", "typescript", "react", "node", "kubernetes", "gke",
		"postgres", "postgresql", "qdrant", "rag", "llm", "vertex", "docker",
		"cloud", "security", "ssr", "fastify", "microservices", "ci/cd",
	}
}

func analyzeJDMatch(jd string, sources []contracts.AskSource) (int, []string, []string) {
	lowerJD := strings.ToLower(jd)
	var corpus strings.Builder
	scoreSum := 0.0
	for _, s := range sources {
		corpus.WriteString(strings.ToLower(s.Title))
		corpus.WriteByte(' ')
		corpus.WriteString(strings.ToLower(s.Snippet))
		corpus.WriteByte(' ')
		scoreSum += s.Score
	}
	corpusText := corpus.String()

	matched := make([]string, 0, 6)
	missing := make([]string, 0, 4)
	for _, kw := range curatedJDKeywords() {
		if strings.Contains(lowerJD, kw) {
			if strings.Contains(corpusText, kw) {
				matched = append(matched, fmt.Sprintf("Direct portfolio evidence for %s", kw))
			} else {
				missing = append(missing, fmt.Sprintf("No indexed portfolio evidence explicitly mentioning %s", kw))
			}
		}
	}

	if len(matched) == 0 && len(sources) > 0 {
		for _, s := range sources {
			matched = append(matched, fmt.Sprintf("Evidence match: %s (%.2f)", s.Title, s.Score))
			if len(matched) >= 3 {
				break
			}
		}
	}

	// Extract any extra unmatched domain tokens from the JD if gaps is empty.
	if len(missing) == 0 {
		jdTokens := tokenRegex.FindAllString(lowerJD, -1)
		seen := map[string]bool{}
		for _, tok := range jdTokens {
			if len(tok) < 5 || seen[tok] {
				continue
			}
			seen[tok] = true
			if !strings.Contains(corpusText, tok) {
				missing = append(missing, fmt.Sprintf("Role requirement %q not directly verified in indexed portfolio corpus", tok))
				if len(missing) >= 2 {
					break
				}
			}
		}
	}

	avgScore := 0.0
	if len(sources) > 0 {
		avgScore = scoreSum / float64(len(sources))
	}
	coverage := 0.5
	totalKW := len(matched) + len(missing)
	if totalKW > 0 {
		coverage = float64(len(matched)) / float64(totalKW)
	}
	pct := int(math.Round((avgScore*0.65 + coverage*0.35) * 100))
	if pct < 15 {
		pct = 15
	}
	if pct > 98 {
		pct = 98
	}
	if len(matched) > 5 {
		matched = matched[:5]
	}
	if len(missing) > 4 {
		missing = missing[:4]
	}
	return pct, matched, missing
}

func stringFromPayload(payload map[string]any, key, fallback string) string {
	if payload == nil {
		return fallback
	}
	if v, ok := payload[key].(string); ok && strings.TrimSpace(v) != "" {
		return strings.TrimSpace(v)
	}
	return fallback
}

func buildAbstention(mode, providerName, reason string, quota *contracts.QuotaStatus) askResponse {
	return askResponse{
		Grounded:   false,
		Mode:       mode,
		Provider:   providerName,
		TokensUsed: 0,
		Answer:     reason,
		Sources:    []contracts.AskSource{},
		Quota:      quota,
	}
}

func newHandler(provider llm.Provider, vectorStore *qdrant.Client, store *pg.Store) http.Handler {
	if store == nil {
		store = pg.NewMemoryStore()
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", httpkit.NewHealthHandler("ai-ask"))

	mux.HandleFunc("GET /v1/ask/status", func(w http.ResponseWriter, r *http.Request) {
		info, err := vectorStore.CollectionInfo(r.Context(), portfolioCollection)
		status := "ready"
		var collectionInfo any = info
		if err != nil {
			status = "degraded"
			collectionInfo = map[string]any{
				"name":        portfolioCollection,
				"status":      "unreachable",
				"pointsCount": 0,
				"error":       err.Error(),
			}
		}
		httpkit.WriteJSON(w, http.StatusOK, map[string]any{
			"status":      status,
			"provider":    provider.Name(),
			"pgConnected": store.IsLivePG(),
			"collection":  collectionInfo,
		})
	})

	mux.HandleFunc("POST /v1/ask/reindex", func(w http.ResponseWriter, r *http.Request) {
		if !internalauth.IsAdminRequest(r) {
			httpkit.WriteError(w, http.StatusForbidden, "admin internal auth token required")
			return
		}

		docs, err := store.LoadCorpusDocs(r.Context())
		if err != nil {
			httpkit.WriteError(w, http.StatusInternalServerError, fmt.Sprintf("failed to load corpus docs: %v", err))
			return
		}
		docs = append(docs, curatedSummaryDocs...)

		points := make([]qdrant.Point, 0, len(docs))
		vectorSize := 0
		for i, doc := range docs {
			embedInput := strings.TrimSpace(doc.Title + "\n" + doc.Snippet)
			vec, embedErr := provider.Embed(r.Context(), embedInput)
			if embedErr != nil {
				httpkit.WriteError(w, http.StatusBadGateway, fmt.Sprintf("embedding failed during reindex: %v", embedErr))
				return
			}
			if len(vec) == 0 {
				continue
			}
			if vectorSize == 0 {
				vectorSize = len(vec)
				if ensureErr := vectorStore.EnsureCollection(r.Context(), portfolioCollection, vectorSize); ensureErr != nil {
					httpkit.WriteError(w, http.StatusBadGateway, fmt.Sprintf("qdrant ensure collection failed: %v", ensureErr))
					return
				}
			}
			points = append(points, qdrant.Point{
				ID:     uint64(i + 1),
				Vector: vec,
				Payload: map[string]any{
					"docId":    doc.ID,
					"title":    doc.Title,
					"snippet":  doc.Snippet,
					"category": doc.Category,
					"source":   doc.Source,
				},
			})
		}

		if len(points) > 0 {
			if upsertErr := vectorStore.UpsertPoints(r.Context(), portfolioCollection, points); upsertErr != nil {
				httpkit.WriteError(w, http.StatusBadGateway, fmt.Sprintf("qdrant upsert failed: %v", upsertErr))
				return
			}
		}

		httpkit.WriteJSON(w, http.StatusOK, map[string]any{
			"indexed":    len(points),
			"collection": portfolioCollection,
			"vectorSize": vectorSize,
			"provider":   provider.Name(),
		})
	})

	mux.HandleFunc("POST /v1/ask", func(w http.ResponseWriter, r *http.Request) {
		var req askRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			httpkit.WriteError(w, http.StatusBadRequest, "invalid JSON payload")
			return
		}

		mode := strings.TrimSpace(req.Mode)
		if mode == "" {
			mode = "qa"
		}
		if mode != "qa" && mode != "jd_match" {
			httpkit.WriteError(w, http.StatusBadRequest, "mode must be qa or jd_match")
			return
		}

		var queryText string
		if mode == "qa" {
			queryText = strings.TrimSpace(req.Question)
			if len(queryText) < 4 || len(queryText) > 800 {
				httpkit.WriteError(w, http.StatusBadRequest, "question must be between 4 and 800 characters")
				return
			}
		} else {
			queryText = strings.TrimSpace(req.JobDescription)
			if queryText == "" {
				queryText = strings.TrimSpace(req.Question)
			}
			if len(queryText) < 20 || len(queryText) > 8000 {
				httpkit.WriteError(w, http.StatusBadRequest, "jobDescription must be between 20 and 8000 characters")
				return
			}
		}

		// Never trust caller-claimed admin role without signed X-Internal-Auth.
		role := contracts.RoleGuest
		if internalauth.IsAdminRequest(r) {
			role = contracts.RoleAdmin
		}
		sessionID := strings.TrimSpace(req.SessionID)
		if sessionID == "" {
			sessionID = strings.TrimSpace(r.Header.Get("X-Session-Id"))
		}
		if sessionID == "" {
			sessionID = "anonymous"
		}

		quota, allowed, quotaErr := store.CheckAndConsumeQuota(r.Context(), role, sessionID, 1, 512)
		if quotaErr != nil {
			httpkit.WriteError(w, http.StatusInternalServerError, "failed to evaluate quota")
			return
		}
		if !allowed {
			httpkit.WriteJSON(w, http.StatusTooManyRequests, map[string]any{
				"error": "Session or daily quota exceeded. Try again later.",
				"quota": quota,
			})
			return
		}

		vec, err := provider.Embed(r.Context(), queryText)
		if err != nil {
			httpkit.WriteJSON(w, http.StatusOK, buildAbstention(
				mode,
				provider.Name(),
				"Abstaining: local/prod embedding provider is unavailable right now.",
				&quota,
			))
			return
		}

		limit := 4
		if mode == "jd_match" {
			limit = 6
		}
		hits, err := vectorStore.Search(r.Context(), portfolioCollection, vec, limit)
		if err != nil || len(hits) == 0 {
			httpkit.WriteJSON(w, http.StatusOK, buildAbstention(
				mode,
				provider.Name(),
				"Abstaining: no grounded portfolio evidence matched your request.",
				&quota,
			))
			return
		}

		filtered := make([]qdrant.SearchHit, 0, len(hits))
		topScore := 0.0
		for _, hit := range hits {
			if hit.Score > topScore {
				topScore = hit.Score
			}
			if hit.Score >= minGroundScore {
				filtered = append(filtered, hit)
			}
		}
		if topScore < minGroundScore || len(filtered) == 0 {
			httpkit.WriteJSON(w, http.StatusOK, buildAbstention(
				mode,
				provider.Name(),
				fmt.Sprintf("Abstaining: top corpus evidence score (%.2f) fell below strict grounding threshold (%.2f).", topScore, minGroundScore),
				&quota,
			))
			return
		}

		var ctxBuilder strings.Builder
		sources := make([]contracts.AskSource, 0, len(filtered))
		for i, hit := range filtered {
			docID := stringFromPayload(hit.Payload, "docId", fmt.Sprintf("%v", hit.ID))
			title := stringFromPayload(hit.Payload, "title", "Portfolio Evidence")
			snippet := stringFromPayload(hit.Payload, "snippet", "")
			category := stringFromPayload(hit.Payload, "category", "portfolio")
			sources = append(sources, contracts.AskSource{
				ID:       docID,
				Title:    title,
				Snippet:  snippet,
				Score:    hit.Score,
				Category: category,
			})
			fmt.Fprintf(&ctxBuilder, "[%d] %s (%s, score=%.2f): %s\n", i+1, title, category, hit.Score, snippet)
		}

		systemPrompt := "Answer strictly from the provided portfolio evidence. Cite source titles. If evidence is insufficient, abstain."
		userPrompt := fmt.Sprintf("Evidence:\n%s\nQuestion: %s", ctxBuilder.String(), queryText)
		if mode == "jd_match" {
			systemPrompt = "Evaluate how Andrew Klapper's indexed portfolio evidence matches the provided Job Description. Be objective, cite evidence, and list concrete gaps without fabricating experience."
			userPrompt = fmt.Sprintf("Portfolio Evidence:\n%s\nJob Description:\n%s", ctxBuilder.String(), queryText)
		}

		completion, err := provider.Chat(r.Context(), []llm.ChatMessage{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: userPrompt},
		}, 512)
		if err != nil {
			httpkit.WriteJSON(w, http.StatusOK, buildAbstention(
				mode,
				provider.Name(),
				"Abstaining: LLM inference backend is unreachable right now.",
				&quota,
			))
			return
		}

		resp := askResponse{
			Grounded:   true,
			Mode:       mode,
			Provider:   provider.Name(),
			Model:      completion.Model,
			TokensUsed: completion.TokensUsed,
			Answer:     completion.Text,
			Sources:    sources,
			Quota:      &quota,
		}
		if mode == "jd_match" {
			score, strengths, gaps := analyzeJDMatch(queryText, sources)
			resp.MatchScore = &score
			resp.Strengths = strengths
			resp.Gaps = gaps
		}

		httpkit.WriteJSON(w, http.StatusOK, resp)
	})

	return mux
}

func main() {
	addr := httpkit.ListenAddr("8083")
	store := pg.OpenBestEffort(context.Background())
	defer store.Close()

	log.Printf("ai-ask listening on %s (pgLive=%v)", addr, store.IsLivePG())
	if err := httpkit.ListenAndServeGraceful(addr, newHandler(llm.NewFromEnv(), qdrant.NewFromEnv(), store)); err != nil {
		log.Fatal(err)
	}
}
