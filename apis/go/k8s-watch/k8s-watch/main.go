package main

import (
	"log"
	"net/http"
	"time"

	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
	"github.com/AndrewK4758/aklapper/packages/go/kit/httpkit"
	"github.com/AndrewK4758/aklapper/packages/go/kit/k8sevents"
)

func newHandler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", httpkit.NewHealthHandler("k8s-watch"))

	mux.HandleFunc("GET /v1/cluster/stream", func(w http.ResponseWriter, r *http.Request) {
		role := contracts.RoleGuest
		if r.Header.Get("X-Admin-Role") == contracts.RoleAdmin {
			role = contracts.RoleAdmin
		}

		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Connection", "keep-alive")

		sample := []contracts.K8sPodEvent{
			k8sevents.NewScaleEvent("evt-1", contracts.PublicNamespace, "cadence-demo", "ScaledZero", "Idle at 0 replicas", false),
			k8sevents.NewScaleEvent("evt-2", contracts.AdminNamespace, "cadence-admin", "ScaledZero", "Isolated admin runtime", false),
		}

		for _, ev := range k8sevents.FilterForRole(sample, role) {
			_ = httpkit.WriteSSEEvent(w, "pod", ev)
		}
	})

	mux.HandleFunc("POST /v1/cluster/wake/{deployment}", func(w http.ResponseWriter, r *http.Request) {
		deployment := r.PathValue("deployment")
		if deployment == "" {
			httpkit.WriteError(w, http.StatusBadRequest, "deployment is required")
			return
		}
		if deployment == "cadence-admin" && r.Header.Get("X-Admin-Role") != contracts.RoleAdmin {
			httpkit.WriteError(w, http.StatusForbidden, "admin role required to wake isolated admin workload")
			return
		}
		ns := contracts.PublicNamespace
		if deployment == "cadence-admin" {
			ns = contracts.AdminNamespace
		}
		ev := k8sevents.NewScaleEvent("wake-"+deployment, ns, deployment, "TriggeredScaleUp", "Activator requested scale 0 -> 1", false)
		pct := 25
		osc := contracts.Osc7501Status{
			Source:    deployment,
			State:     "scaling",
			Label:     "Waking " + deployment + " from 0 replicas",
			Progress:  &pct,
			Timestamp: time.Now().UTC(),
		}
		httpkit.WriteJSON(w, http.StatusAccepted, map[string]any{
			"event":   ev,
			"osc7501": k8sevents.FormatOSC7501(osc),
		})
	})

	return mux
}

func main() {
	addr := httpkit.ListenAddr("8081")
	log.Printf("k8s-watch listening on %s", addr)
	if err := httpkit.ListenAndServeGraceful(addr, newHandler()); err != nil {
		log.Fatal(err)
	}
}
