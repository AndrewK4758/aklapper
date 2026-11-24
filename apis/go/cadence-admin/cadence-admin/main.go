package main

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
	"github.com/AndrewK4758/aklapper/packages/go/kit/httpkit"
	"github.com/AndrewK4758/aklapper/packages/go/kit/internalauth"
	"github.com/AndrewK4758/aklapper/packages/go/kit/pg"
)

type gateOverrideRequest struct {
	GateVerdict string `json:"gateVerdict"`
}

func requireAdmin(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !internalauth.IsAdminRequest(r) {
			httpkit.WriteError(w, http.StatusForbidden, "signed admin internal auth required")
			return
		}
		next(w, r)
	}
}

func newHandler(store *pg.Store) http.Handler {
	if store == nil {
		store = pg.NewMemoryStore()
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", httpkit.NewHealthHandler("cadence-admin"))

	mux.HandleFunc("GET /v1/admin/status", requireAdmin(func(w http.ResponseWriter, r *http.Request) {
		totalRuns, pendingGates, err := store.GetSandboxRunSummary(r.Context())
		if err != nil {
			httpkit.WriteError(w, http.StatusInternalServerError, "failed to load sandbox run summary")
			return
		}
		httpkit.WriteJSON(w, http.StatusOK, map[string]any{
			"namespace":         contracts.AdminNamespace,
			"isolated":          true,
			"mode":              "full-cadence-runtime",
			"databaseConnected": store.IsLivePG(),
			"totalSandboxRuns":  totalRuns,
			"pendingGates":      pendingGates,
			"timestamp":         time.Now().UTC().Format(time.RFC3339),
		})
	}))

	mux.HandleFunc("GET /v1/admin/runs", requireAdmin(func(w http.ResponseWriter, r *http.Request) {
		limit := 25
		if raw := strings.TrimSpace(r.URL.Query().Get("limit")); raw != "" {
			parsed, err := strconv.Atoi(raw)
			if err != nil || parsed <= 0 {
				httpkit.WriteError(w, http.StatusBadRequest, "limit must be a positive integer")
				return
			}
			if parsed > 50 {
				parsed = 50
			}
			limit = parsed
		}
		sessionID := strings.TrimSpace(r.URL.Query().Get("sessionId"))
		runs, err := store.ListSandboxRuns(r.Context(), sessionID, limit)
		if err != nil {
			httpkit.WriteError(w, http.StatusInternalServerError, "failed to list sandbox runs")
			return
		}
		httpkit.WriteJSON(w, http.StatusOK, map[string]any{
			"runs":  runs,
			"count": len(runs),
		})
	}))

	mux.HandleFunc("POST /v1/admin/runs/{id}/gate", requireAdmin(func(w http.ResponseWriter, r *http.Request) {
		runID := strings.TrimSpace(r.PathValue("id"))
		if runID == "" {
			httpkit.WriteError(w, http.StatusBadRequest, "run id is required")
			return
		}

		var req gateOverrideRequest
		dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096))
		dec.DisallowUnknownFields()
		if err := dec.Decode(&req); err != nil {
			httpkit.WriteError(w, http.StatusBadRequest, "invalid JSON payload")
			return
		}

		verdict := strings.ToLower(strings.TrimSpace(req.GateVerdict))
		updated, err := store.OverrideSandboxGateVerdict(r.Context(), runID, verdict)
		if errors.Is(err, pg.ErrInvalidAdminVerdict) {
			httpkit.WriteError(w, http.StatusBadRequest, err.Error())
			return
		}
		if errors.Is(err, pg.ErrRunNotFound) {
			httpkit.WriteError(w, http.StatusNotFound, err.Error())
			return
		}
		if err != nil {
			httpkit.WriteError(w, http.StatusInternalServerError, "failed to override gate verdict")
			return
		}

		httpkit.WriteJSON(w, http.StatusOK, updated)
	}))

	return mux
}

func main() {
	store := pg.OpenBestEffort(context.Background())
	defer store.Close()

	addr := httpkit.ListenAddr("8085")
	log.Printf("cadence-admin listening on %s (livePG=%v)", addr, store.IsLivePG())
	if err := httpkit.ListenAndServeGraceful(addr, newHandler(store)); err != nil {
		log.Fatal(err)
	}
}
