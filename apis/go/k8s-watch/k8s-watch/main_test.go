package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
	"github.com/AndrewK4758/aklapper/packages/go/kit/internalauth"
)

func TestK8sWatchInClusterDiscoveryAndRBAC(t *testing.T) {
	t.Setenv("INTERNAL_AUTH_SECRET", "k8s-unit-secret")

	k8sSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer test-sa-token" {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		switch r.URL.Path {
		case "/apis/apps/v1/namespaces/portfolio-public/deployments":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"items": []map[string]any{
					{
						"metadata": map[string]any{"name": "svc-cadence-demo", "namespace": "portfolio-public"},
						"spec":     map[string]any{"replicas": 1},
						"status":   map[string]any{"readyReplicas": 1},
					},
					{
						"metadata": map[string]any{"name": "svc-ai-ask", "namespace": "portfolio-public"},
						"spec":     map[string]any{"replicas": 0},
						"status":   map[string]any{"readyReplicas": 0},
					},
				},
			})
		case "/apis/apps/v1/namespaces/cadence-admin/deployments":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"items": []map[string]any{
					{
						"metadata": map[string]any{"name": "cadence-admin-runner", "namespace": "cadence-admin"},
						"spec":     map[string]any{"replicas": 1},
						"status":   map[string]any{"readyReplicas": 0},
					},
				},
			})
		default:
			http.NotFound(w, r)
		}
	}))
	defer k8sSrv.Close()

	client := &k8sAPIClient{
		baseURL: k8sSrv.URL,
		token:   "test-sa-token",
		http:    k8sSrv.Client(),
	}
	h := newHandler(client)

	t.Run("guest receives only portfolio-public deployments from K8s API", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/v1/cluster/stream", nil)
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", rec.Code)
		}
		body := rec.Body.String()
		if !strings.Contains(body, "svc-cadence-demo") || !strings.Contains(body, "svc-ai-ask") {
			t.Fatalf("expected public deployments in SSE stream, got: %s", body)
		}
		if strings.Contains(body, "cadence-admin") {
			t.Fatalf("guest stream must not include cadence-admin: %s", body)
		}
	})

	t.Run("verified admin receives both portfolio-public and cadence-admin deployments", func(t *testing.T) {
		tok, err := internalauth.Sign(internalauth.RoleAdmin, "aklapper", time.Minute, "k8s-unit-secret")
		if err != nil {
			t.Fatalf("sign: %v", err)
		}
		req := httptest.NewRequest(http.MethodGet, "/v1/cluster/stream", nil)
		req.Header.Set(internalauth.HeaderName, tok)
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		body := rec.Body.String()
		if !strings.Contains(body, "cadence-admin-runner") || !strings.Contains(body, contracts.AdminNamespace) {
			t.Fatalf("expected admin deployment in SSE stream, got: %s", body)
		}
	})

	t.Run("nil client falls back to local scale-from-zero simulation", func(t *testing.T) {
		simHandler := newHandler(nil)
		req := httptest.NewRequest(http.MethodGet, "/v1/cluster/stream", nil)
		rec := httptest.NewRecorder()
		simHandler.ServeHTTP(rec, req)
		if !strings.Contains(rec.Body.String(), "cadence-demo") {
			t.Fatalf("expected simulated cadence-demo event, got: %s", rec.Body.String())
		}
	})
}
