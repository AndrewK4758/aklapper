package main

import (
	"net/http"
	"strings"
	"sync"

	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
	"github.com/AndrewK4758/aklapper/packages/go/kit/httpkit"
	"github.com/AndrewK4758/aklapper/packages/go/kit/internalauth"
	"github.com/AndrewK4758/aklapper/packages/go/kit/llm"
	"github.com/AndrewK4758/aklapper/packages/go/kit/pg"
	"github.com/AndrewK4758/aklapper/packages/go/kit/qdrant"
)

func handleReindex(provider llm.Provider, vectorStore *qdrant.Client, store *pg.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		corrID := extractCorrelationID(r)
		if !internalauth.IsAdminRequest(r) {
			writePublicError(w, http.StatusForbidden, contracts.ErrCodeForbidden,
				"Permission denied for action.", "Return home or sign in again.", corrID)
			return
		}

		docs, err := store.LoadCorpusDocs(r.Context())
		if err != nil {
			logAskEvent("ai_ask.reindex.pg_error", map[string]any{
				"correlationId": corrID,
				"seam_type":     "BOUNDARY_FAULT",
			})
			writePublicError(w, http.StatusServiceUnavailable, contracts.ErrCodeDbUnavailable,
				"Database temporarily unavailable.", "Retry shortly or share ID.", corrID)
			return
		}

		dedup := make([]pg.CorpusDocument, 0, len(docs)+len(curatedSummaryDocs))
		seenIDs := make(map[string]struct{}, len(docs)+len(curatedSummaryDocs))
		for _, doc := range append(docs, curatedSummaryDocs...) {
			if _, exists := seenIDs[doc.ID]; exists {
				continue
			}
			seenIDs[doc.ID] = struct{}{}
			dedup = append(dedup, doc)
		}

		type indexedSlot struct {
			point qdrant.Point
			ok    bool
		}
		slots := make([]indexedSlot, len(dedup))
		sem := make(chan struct{}, 4)
		var wg sync.WaitGroup
		var mu sync.Mutex
		var firstEmbedErr error

		for i, doc := range dedup {
			wg.Add(1)
			go func(idx int, d pg.CorpusDocument) {
				defer wg.Done()
				sem <- struct{}{}
				defer func() { <-sem }()

				embedInput := strings.TrimSpace(d.Title + "\n" + d.Snippet)
				vec, embedErr := provider.Embed(r.Context(), embedInput)
				if embedErr == nil {
					embedErr = llm.ValidateEmbeddingDims(vec)
				}
				if embedErr != nil {
					mu.Lock()
					if firstEmbedErr == nil {
						firstEmbedErr = embedErr
					}
					mu.Unlock()
					return
				}
				slots[idx] = indexedSlot{
					ok: true,
					point: qdrant.Point{
						ID:     qdrant.PortfolioPointID(d.ID, 0),
						Vector: vec,
						Payload: map[string]any{
							"docId":    d.ID,
							"title":    d.Title,
							"snippet":  d.Snippet,
							"category": d.Category,
							"source":   d.Source,
						},
					},
				}
			}(i, doc)
		}
		wg.Wait()

		if firstEmbedErr != nil {
			logAskEvent("ai_ask.reindex.embed_error", map[string]any{
				"correlationId": corrID,
				"seam_type":     "BOUNDARY_FAULT",
			})
			writePublicError(w, http.StatusBadGateway, contracts.ErrCodeUpstreamUnavailable,
				"Upstream service unreachable.", "Retry shortly or go home.", corrID)
			return
		}

		if err := vectorStore.EnsureCollection(r.Context(), portfolioCollection, llm.ExpectedEmbeddingDims); err != nil {
			writePublicError(w, http.StatusBadGateway, contracts.ErrCodeUpstreamUnavailable,
				"Upstream service unreachable.", "Retry shortly or go home.", corrID)
			return
		}

		points := make([]qdrant.Point, 0, len(slots))
		keepIDs := make(map[string]struct{}, len(slots))
		for _, slot := range slots {
			if slot.ok {
				if idStr, ok := slot.point.ID.(string); ok {
					keepIDs[idStr] = struct{}{}
				}
				points = append(points, slot.point)
			}
		}

		if len(points) > 0 {
			if err := vectorStore.UpsertPoints(r.Context(), portfolioCollection, points); err != nil {
				writePublicError(w, http.StatusBadGateway, contracts.ErrCodeUpstreamUnavailable,
					"Upstream service unreachable.", "Retry shortly or go home.", corrID)
				return
			}
		}

		existingIDs, listErr := vectorStore.ListPointIDs(r.Context(), portfolioCollection)
		if listErr != nil {
			writePublicError(w, http.StatusBadGateway, contracts.ErrCodeUpstreamUnavailable,
				"Upstream service unreachable.", "Retry shortly or go home.", corrID)
			return
		}
		staleIDs := make([]any, 0)
		for _, id := range existingIDs {
			if _, keep := keepIDs[id]; !keep {
				staleIDs = append(staleIDs, id)
			}
		}
		if len(staleIDs) > 0 {
			if delErr := vectorStore.DeletePoints(r.Context(), portfolioCollection, staleIDs); delErr != nil {
				writePublicError(w, http.StatusBadGateway, contracts.ErrCodeUpstreamUnavailable,
					"Upstream service unreachable.", "Retry shortly or go home.", corrID)
				return
			}
		}

		httpkit.WriteJSON(w, http.StatusOK, map[string]any{
			"indexed":       len(points),
			"pruned":        len(staleIDs),
			"collection":    portfolioCollection,
			"vectorSize":    llm.ExpectedEmbeddingDims,
			"provider":      provider.Name(),
			"correlationId": corrID,
		})
	}
}
