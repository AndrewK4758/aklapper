package main

import (
	"context"
	"errors"
	"net/http"
	"os"
	"strings"

	"connectrpc.com/connect"
	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
	"github.com/AndrewK4758/aklapper/packages/go/kit/httpkit"
	"github.com/AndrewK4758/aklapper/packages/go/kit/internalauth"
	"github.com/AndrewK4758/aklapper/packages/go/kit/llm"
	"github.com/AndrewK4758/aklapper/packages/go/kit/pg"
	"github.com/AndrewK4758/aklapper/packages/go/kit/qdrant"
	"github.com/AndrewK4758/aklapper/packages/go/kit/qdrantseed"
)

type reindexOutcome struct {
	Indexed       int
	Pruned        int
	Collection    string
	VectorSize    int
	Provider      string
	CorrelationID string
}

type reindexFailure struct {
	HTTPStatus  int
	ConnectCode connect.Code
	Error       contracts.PublicAppError
}

func executeReindex(
	ctx context.Context,
	provider llm.Provider,
	vectorStore *qdrant.Client,
	store *pg.Store,
	corrID string,
) (*reindexOutcome, *reindexFailure) {
	pgDisabled := strings.EqualFold(strings.TrimSpace(os.Getenv("PG_DISABLE_LIVE")), "true")
	if !pgDisabled && (store == nil || !store.IsLivePG() || store.OpenError() != nil) {
		logAskEvent("ai_ask.reindex.pg_error", map[string]any{
			"correlationId": corrID,
			"seam_type":     "BOUNDARY_FAULT",
		})
		return nil, &reindexFailure{
			HTTPStatus:  http.StatusServiceUnavailable,
			ConnectCode: connect.CodeUnavailable,
			Error: contracts.PublicAppError{
				Code:          contracts.ErrCodeDbUnavailable,
				Status:        http.StatusServiceUnavailable,
				Message:       "Database temporarily unavailable.",
				Action:        "Retry shortly or share ID.",
				CorrelationID: corrID,
			},
		}
	}

	opts := qdrantseed.DefaultSeedOptions()
	opts.Collections = []string{portfolioCollection}
	opts.PruneOrphans = true

	res, err := qdrantseed.SeedPortfolioDocs(ctx, provider, vectorStore, store, opts)
	if err != nil {
		return nil, classifyReindexError(err, corrID)
	}

	return &reindexOutcome{
		Indexed:       res.Indexed,
		Pruned:        res.Pruned,
		Collection:    res.Collection,
		VectorSize:    res.VectorSize,
		Provider:      res.Provider,
		CorrelationID: corrID,
	}, nil
}

func classifyReindexError(err error, corrID string) *reindexFailure {
	switch {
	case errors.Is(err, qdrantseed.ErrReindexLocked):
		logAskEvent("ai_ask.reindex.lock_contended", map[string]any{
			"correlationId": corrID,
			"seam_type":     "UNSOUND_CONDITION",
		})
		return &reindexFailure{
			HTTPStatus:  http.StatusConflict,
			ConnectCode: connect.CodeFailedPrecondition,
			Error: contracts.PublicAppError{
				Code:          contracts.ErrCodeConstraint,
				Status:        http.StatusConflict,
				Message:       "A portfolio reindex is already in progress.",
				Action:        "Wait for the active reindex to complete and retry.",
				CorrelationID: corrID,
			},
		}
	case errors.Is(err, qdrantseed.ErrPostgresUnavailable):
		logAskEvent("ai_ask.reindex.pg_error", map[string]any{
			"correlationId": corrID,
			"seam_type":     "BOUNDARY_FAULT",
		})
		return &reindexFailure{
			HTTPStatus:  http.StatusServiceUnavailable,
			ConnectCode: connect.CodeUnavailable,
			Error: contracts.PublicAppError{
				Code:          contracts.ErrCodeDbUnavailable,
				Status:        http.StatusServiceUnavailable,
				Message:       "Database temporarily unavailable.",
				Action:        "Retry shortly or share ID.",
				CorrelationID: corrID,
			},
		}
	case errors.Is(err, qdrantseed.ErrOriginConfidentiality):
		logAskEvent("ai_ask.reindex.confidentiality_rejected", map[string]any{
			"correlationId": corrID,
			"seam_type":     "BOUNDARY_FAULT",
		})
		return &reindexFailure{
			HTTPStatus:  http.StatusUnprocessableEntity,
			ConnectCode: connect.CodeFailedPrecondition,
			Error: contracts.PublicAppError{
				Code:          contracts.ErrCodeConstraint,
				Status:        http.StatusUnprocessableEntity,
				Message:       "Corpus document rejected by content policy.",
				Action:        "Remove restricted content and retry.",
				CorrelationID: corrID,
			},
		}
	case errors.Is(err, qdrantseed.ErrEmbedOperation), errors.Is(err, qdrantseed.ErrInvalidVectorConfig):
		logAskEvent("ai_ask.reindex.embed_error", map[string]any{
			"correlationId": corrID,
			"seam_type":     "BOUNDARY_FAULT",
		})
	case errors.Is(err, qdrantseed.ErrQdrantScroll):
		logAskEvent("ask.reindex.prune_mismatch", map[string]any{
			"correlationId": corrID,
			"seam_type":     "DELTA_AUDIT_GAP",
			"stage":         "scroll",
		})
	case errors.Is(err, qdrantseed.ErrQdrantDelete):
		logAskEvent("ask.reindex.prune_mismatch", map[string]any{
			"correlationId": corrID,
			"seam_type":     "DELTA_AUDIT_GAP",
			"stage":         "delete",
		})
	}
	return &reindexFailure{
		HTTPStatus:  http.StatusBadGateway,
		ConnectCode: connect.CodeUnavailable,
		Error: contracts.PublicAppError{
			Code:          contracts.ErrCodeUpstreamUnavailable,
			Status:        http.StatusBadGateway,
			Message:       "Upstream service unreachable.",
			Action:        "Retry shortly or go home.",
			CorrelationID: corrID,
		},
	}
}

func handleReindex(provider llm.Provider, vectorStore *qdrant.Client, store *pg.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		corrID := extractCorrelationID(r)
		if !internalauth.IsAdminRequest(r) {
			writePublicError(w, http.StatusForbidden, contracts.ErrCodeForbidden,
				"Permission denied for action.", "Return home or sign in again.", corrID)
			return
		}

		res, fail := executeReindex(r.Context(), provider, vectorStore, store, corrID)
		if fail != nil {
			writePublicError(w, fail.HTTPStatus, fail.Error.Code, fail.Error.Message, fail.Error.Action, fail.Error.CorrelationID)
			return
		}

		httpkit.WriteJSON(w, http.StatusOK, map[string]any{
			"indexed":       res.Indexed,
			"pruned":        res.Pruned,
			"collection":    res.Collection,
			"vectorSize":    res.VectorSize,
			"provider":      res.Provider,
			"correlationId": res.CorrelationID,
		})
	}
}
