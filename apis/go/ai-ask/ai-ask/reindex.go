package main

import (
	"errors"
	"net/http"
	"os"
	"strings"

	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
	"github.com/AndrewK4758/aklapper/packages/go/kit/httpkit"
	"github.com/AndrewK4758/aklapper/packages/go/kit/internalauth"
	"github.com/AndrewK4758/aklapper/packages/go/kit/llm"
	"github.com/AndrewK4758/aklapper/packages/go/kit/pg"
	"github.com/AndrewK4758/aklapper/packages/go/kit/qdrant"
	"github.com/AndrewK4758/aklapper/packages/go/kit/qdrantseed"
)

func handleReindex(provider llm.Provider, vectorStore *qdrant.Client, store *pg.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		corrID := extractCorrelationID(r)
		if !internalauth.IsAdminRequest(r) {
			writePublicError(w, http.StatusForbidden, contracts.ErrCodeForbidden,
				"Permission denied for action.", "Return home or sign in again.", corrID)
			return
		}

		pgDisabled := strings.EqualFold(strings.TrimSpace(os.Getenv("PG_DISABLE_LIVE")), "true")
		if !pgDisabled && (store == nil || !store.IsLivePG() || store.OpenError() != nil) {
			logAskEvent("ai_ask.reindex.pg_error", map[string]any{
				"correlationId": corrID,
				"seam_type":     "BOUNDARY_FAULT",
			})
			writePublicError(w, http.StatusServiceUnavailable, contracts.ErrCodeDbUnavailable,
				"Database temporarily unavailable.", "Retry shortly or share ID.", corrID)
			return
		}

		opts := qdrantseed.DefaultSeedOptions()
		opts.Collections = []string{portfolioCollection}
		opts.PruneOrphans = true

		res, err := qdrantseed.SeedPortfolioDocs(r.Context(), provider, vectorStore, store, opts)
		if err != nil {
			switch {
			case errors.Is(err, qdrantseed.ErrPostgresUnavailable):
				logAskEvent("ai_ask.reindex.pg_error", map[string]any{
					"correlationId": corrID,
					"seam_type":     "BOUNDARY_FAULT",
				})
				writePublicError(w, http.StatusServiceUnavailable, contracts.ErrCodeDbUnavailable,
					"Database temporarily unavailable.", "Retry shortly or share ID.", corrID)
			case errors.Is(err, qdrantseed.ErrOriginConfidentiality):
				logAskEvent("ai_ask.reindex.confidentiality_rejected", map[string]any{
					"correlationId": corrID,
					"seam_type":     "BOUNDARY_FAULT",
				})
				writePublicError(w, http.StatusUnprocessableEntity, contracts.ErrCodeValidation,
					"Corpus document rejected by content policy.", "Remove restricted content and retry.", corrID)
			case errors.Is(err, qdrantseed.ErrEmbedOperation), errors.Is(err, qdrantseed.ErrInvalidVectorConfig):
				logAskEvent("ai_ask.reindex.embed_error", map[string]any{
					"correlationId": corrID,
					"seam_type":     "BOUNDARY_FAULT",
				})
				writePublicError(w, http.StatusBadGateway, contracts.ErrCodeUpstreamUnavailable,
					"Upstream service unreachable.", "Retry shortly or go home.", corrID)
			case errors.Is(err, qdrantseed.ErrQdrantScroll):
				logAskEvent("ask.reindex.prune_mismatch", map[string]any{
					"correlationId": corrID,
					"seam_type":     "DELTA_AUDIT_GAP",
					"stage":         "scroll",
				})
				writePublicError(w, http.StatusBadGateway, contracts.ErrCodeUpstreamUnavailable,
					"Upstream service unreachable.", "Retry shortly or go home.", corrID)
			case errors.Is(err, qdrantseed.ErrQdrantDelete):
				logAskEvent("ask.reindex.prune_mismatch", map[string]any{
					"correlationId": corrID,
					"seam_type":     "DELTA_AUDIT_GAP",
					"stage":         "delete",
				})
				writePublicError(w, http.StatusBadGateway, contracts.ErrCodeUpstreamUnavailable,
					"Upstream service unreachable.", "Retry shortly or go home.", corrID)
			default:
				writePublicError(w, http.StatusBadGateway, contracts.ErrCodeUpstreamUnavailable,
					"Upstream service unreachable.", "Retry shortly or go home.", corrID)
			}
			return
		}

		httpkit.WriteJSON(w, http.StatusOK, map[string]any{
			"indexed":       res.Indexed,
			"pruned":        res.Pruned,
			"collection":    res.Collection,
			"vectorSize":    res.VectorSize,
			"provider":      res.Provider,
			"correlationId": corrID,
		})
	}
}
