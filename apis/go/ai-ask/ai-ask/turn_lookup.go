package main

import (
	"errors"
	"net/http"
	"strings"

	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
	"github.com/AndrewK4758/aklapper/packages/go/kit/httpkit"
	"github.com/AndrewK4758/aklapper/packages/go/kit/internalauth"
	"github.com/AndrewK4758/aklapper/packages/go/kit/pg"
)

func writeReusedTurn(w http.ResponseWriter, turn pg.TurnRecord, quota contracts.QuotaStatus) {
	state := turn.ToState(&quota)
	w.Header().Set("X-Correlation-Id", turn.CorrelationID)
	switch turn.Status {
	case contracts.TurnStatusCompleted, contracts.TurnStatusAbstained:
		if turn.Result != nil {
			httpkit.WriteJSON(w, http.StatusOK, turn.Result)
			return
		}
		httpkit.WriteJSON(w, http.StatusAccepted, state)
	case contracts.TurnStatusFailed, contracts.TurnStatusExpired:
		status := http.StatusBadGateway
		if turn.Status == contracts.TurnStatusExpired {
			status = http.StatusGatewayTimeout
		}
		httpkit.WriteJSON(w, status, state.Error)
	default:
		httpkit.WriteJSON(w, http.StatusAccepted, state)
	}
}

func handleTurnLookup(store *pg.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		corrID := extractCorrelationID(r)
		claims, authErr := internalauth.VerifyRequest(r)
		if authErr != nil {
			writePublicError(w, http.StatusUnauthorized, contracts.ErrCodeUnauthorized,
				"Authentication is required.", "Retry through the portal.", corrID)
			return
		}
		attemptID := strings.TrimSpace(r.PathValue("attemptId"))
		if !contracts.ValidateUUID(attemptID) {
			writePublicError(w, http.StatusBadRequest, contracts.ErrCodeValidation,
				"Invalid attempt identifier.", "Refresh and submit again.", corrID)
			return
		}
		rec, quota, err := store.GetTurnByAttemptID(r.Context(), attemptID, claims.Sub)
		if errors.Is(err, pg.ErrTurnNotFound) {
			writePublicError(w, http.StatusNotFound, contracts.ErrCodeNotFound,
				"Resource could not be found.", "Verify the URL or return home.", corrID)
			return
		}
		if err != nil {
			writePublicError(w, http.StatusServiceUnavailable, contracts.ErrCodeDbUnavailable,
				"Database temporarily unavailable.", "Retry shortly or share ID.", corrID)
			return
		}
		state := rec.ToState(&quota)
		w.Header().Set("X-Correlation-Id", rec.CorrelationID)
		switch rec.Status {
		case contracts.TurnStatusCompleted, contracts.TurnStatusAbstained:
			httpkit.WriteJSON(w, http.StatusOK, state)
		case contracts.TurnStatusExpired:
			httpkit.WriteJSON(w, http.StatusGatewayTimeout, state)
		case contracts.TurnStatusFailed:
			httpkit.WriteJSON(w, http.StatusBadGateway, state)
		default:
			httpkit.WriteJSON(w, http.StatusAccepted, state)
		}
	}
}
