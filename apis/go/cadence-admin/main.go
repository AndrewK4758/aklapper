package main

import (
	"log"
	"net/http"
	"time"

	"github.com/AndrewK4758/aklapper/packages/go/contracts"
	"github.com/AndrewK4758/aklapper/packages/go/httpkit"
)

func requireAdmin(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("X-Admin-Role") != contracts.RoleAdmin {
			httpkit.WriteError(w, http.StatusForbidden, "admin passkey session required")
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
