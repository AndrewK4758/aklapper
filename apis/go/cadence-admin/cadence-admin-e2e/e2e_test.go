package cadenceadmin_e2e_test

import (
	"net/http"
	"testing"
	"time"

	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
	"github.com/AndrewK4758/aklapper/packages/go/kit/httpkit"
	"github.com/AndrewK4758/aklapper/packages/go/kit/httpkit/e2etest"
)

type adminStatusResponse struct {
	Namespace string `json:"namespace"`
	Isolated  bool   `json:"isolated"`
	Mode      string `json:"mode"`
	Timestamp string `json:"timestamp"`
}

func TestCadenceAdminEndToEnd(t *testing.T) {
	t.Parallel()

	baseURL := e2etest.StartBinary(t, "../cadence-admin")

	t.Run("GET /healthz returns healthy status", func(t *testing.T) {
		res, health := e2etest.DoJSON[httpkit.HealthResponse](t, http.MethodGet, baseURL+"/healthz", nil, nil)
		if res.StatusCode != http.StatusOK {
			t.Fatalf("expected 200, got %d", res.StatusCode)
		}
		if !health.OK || health.Service != "cadence-admin" {
			t.Fatalf("unexpected health response: %+v", health)
		}
	})

	t.Run("GET /v1/admin/status blocks missing or guest role headers", func(t *testing.T) {
		resNoHeader, errNoHeader := e2etest.DoJSON[httpkit.ErrorResponse](t, http.MethodGet, baseURL+"/v1/admin/status", nil, nil)
		if resNoHeader.StatusCode != http.StatusForbidden {
			t.Fatalf("expected 403 without header, got %d (%+v)", resNoHeader.StatusCode, errNoHeader)
		}

		resGuest, errGuest := e2etest.DoJSON[httpkit.ErrorResponse](
			t,
			http.MethodGet,
			baseURL+"/v1/admin/status",
			nil,
			map[string]string{"X-Admin-Role": contracts.RoleGuest},
		)
		if resGuest.StatusCode != http.StatusForbidden {
			t.Fatalf("expected 403 for guest role, got %d (%+v)", resGuest.StatusCode, errGuest)
		}
	})

	t.Run("GET /v1/admin/status succeeds for admin role", func(t *testing.T) {
		res, status := e2etest.DoJSON[adminStatusResponse](
			t,
			http.MethodGet,
			baseURL+"/v1/admin/status",
			nil,
			map[string]string{"X-Admin-Role": contracts.RoleAdmin},
		)
		if res.StatusCode != http.StatusOK {
			t.Fatalf("expected 200 for admin role, got %d", res.StatusCode)
		}
		if status.Namespace != contracts.AdminNamespace || !status.Isolated || status.Mode != "full-cadence-runtime" {
			t.Fatalf("unexpected admin status payload: %+v", status)
		}
		if _, err := time.Parse(time.RFC3339, status.Timestamp); err != nil {
			t.Fatalf("expected RFC3339 timestamp, got %q: %v", status.Timestamp, err)
		}
	})

	t.Run("POST /v1/admin/status returns 405 Method Not Allowed", func(t *testing.T) {
		res, _ := e2etest.DoRequest(
			t,
			http.MethodPost,
			baseURL+"/v1/admin/status",
			nil,
			map[string]string{"X-Admin-Role": contracts.RoleAdmin},
		)
		if res.StatusCode != http.StatusMethodNotAllowed {
			t.Fatalf("expected 405, got %d", res.StatusCode)
		}
	})
}
