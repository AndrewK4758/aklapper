package main

import (
	"log"
	"net/http"
	"time"

	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
	"github.com/AndrewK4758/aklapper/packages/go/kit/httpkit"
	"github.com/AndrewK4758/aklapper/packages/go/kit/internalauth"
)

func requireAdmin(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !internalauth.IsAdminRequest(r) {
			httpkit.WriteError(w, http.StatusForbidden, "signed admin internal auth required")
			return
		}
		next(w, r)
	}
}

func newHandler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", httpkit.NewHealthHandler("cadence-admin"))

	mux.HandleFunc("GET /v1/admin/status", requireAdmin(func(w http.ResponseWriter, _ *http.Request) {
		httpkit.WriteJSON(w, http.StatusOK, map[string]any{
			"namespace": contracts.AdminNamespace,
			"isolated":  true,
			"mode":      "full-cadence-runtime",
			"timestamp": time.Now().UTC().Format(time.RFC3339),
		})
	}))

	return mux
}

func main() {
	addr := httpkit.ListenAddr("8085")
	log.Printf("cadence-admin listening on %s", addr)
	if err := httpkit.ListenAndServeGraceful(addr, newHandler()); err != nil {
		log.Fatal(err)
	}
}
