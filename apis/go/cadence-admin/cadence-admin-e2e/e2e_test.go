package cadenceadmin_e2e_test

import (
	"net/http"
	"testing"
	"time"

	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
	"github.com/AndrewK4758/aklapper/packages/go/kit/httpkit"
	"github.com/AndrewK4758/aklapper/packages/go/kit/httpkit/e2etest"
	"github.com/AndrewK4758/aklapper/packages/go/kit/internalauth"
	"github.com/AndrewK4758/aklapper/packages/go/kit/pg"
)

type adminStatusResponse struct {
	Namespace         string `json:"namespace"`
	Isolated          bool   `json:"isolated"`
	Mode              string `json:"mode"`
	DatabaseConnected bool   `json:"databaseConnected"`
	TotalSandboxRuns  int    `json:"totalSandboxRuns"`
	PendingGates      int    `json:"pendingGates"`
	Timestamp         string `json:"timestamp"`
}

type adminRunsResponse struct {
	Runs  []pg.SandboxRun `json:"runs"`
	Count int             `json:"count"`
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

	t.Run("GET /v1/admin/status blocks missing, guest, and spoofed X-Admin-Role headers", func(t *testing.T) {
		resNoHeader, errNoHeader := e2etest.DoJSON[httpkit.ErrorResponse](t, http.MethodGet, baseURL+"/v1/admin/status", nil, nil)
		if resNoHeader.StatusCode != http.StatusForbidden {
			t.Fatalf("expected 403 without header, got %d (%+v)", resNoHeader.StatusCode, errNoHeader)
		}

		resSpoofed, errSpoofed := e2etest.DoJSON[httpkit.ErrorResponse](
			t,
			http.MethodGet,
			baseURL+"/v1/admin/status",
			nil,
			map[string]string{"X-Admin-Role": contracts.RoleAdmin},
		)
		if resSpoofed.StatusCode != http.StatusForbidden {
			t.Fatalf("expected 403 for spoofed X-Admin-Role header, got %d (%+v)", resSpoofed.StatusCode, errSpoofed)
		}

		guestToken, err := internalauth.Sign(internalauth.RoleGuest, "guest-e2e", time.Minute, "")
		if err != nil {
			t.Fatalf("sign guest token: %v", err)
		}
		resGuest, errGuest := e2etest.DoJSON[httpkit.ErrorResponse](
			t,
			http.MethodGet,
			baseURL+"/v1/admin/status",
			nil,
			map[string]string{internalauth.HeaderName: guestToken},
		)
		if resGuest.StatusCode != http.StatusForbidden {
			t.Fatalf("expected 403 for guest token, got %d (%+v)", resGuest.StatusCode, errGuest)
		}
	})

	t.Run("GET /v1/admin/status and /v1/admin/runs succeed for signed admin token", func(t *testing.T) {
		adminToken, err := internalauth.Sign(internalauth.RoleAdmin, "admin-e2e", time.Minute, "")
		if err != nil {
			t.Fatalf("sign admin token: %v", err)
		}
		headers := map[string]string{internalauth.HeaderName: adminToken}

		res, status := e2etest.DoJSON[adminStatusResponse](
			t,
			http.MethodGet,
			baseURL+"/v1/admin/status",
			nil,
			headers,
		)
		if res.StatusCode != http.StatusOK {
			t.Fatalf("expected 200 for signed admin token, got %d", res.StatusCode)
		}
		if status.Namespace != contracts.AdminNamespace || !status.Isolated || status.Mode != "full-cadence-runtime" {
			t.Fatalf("unexpected admin status payload: %+v", status)
		}
		if status.TotalSandboxRuns < 0 || status.PendingGates < 0 {
			t.Fatalf("unexpected negative sandbox counts: %+v", status)
		}
		if _, err := time.Parse(time.RFC3339, status.Timestamp); err != nil {
			t.Fatalf("expected RFC3339 timestamp, got %q: %v", status.Timestamp, err)
		}

		runsRes, runsBody := e2etest.DoJSON[adminRunsResponse](
			t,
			http.MethodGet,
			baseURL+"/v1/admin/runs?limit=5",
			nil,
			headers,
		)
		if runsRes.StatusCode != http.StatusOK {
			t.Fatalf("expected 200 for /v1/admin/runs, got %d", runsRes.StatusCode)
		}
		if runsBody.Count != len(runsBody.Runs) {
			t.Fatalf("mismatched run count: %+v", runsBody)
		}

		missingRes, _ := e2etest.DoJSON[httpkit.ErrorResponse](
			t,
			http.MethodPost,
			baseURL+"/v1/admin/runs/22222222-2222-4222-8222-222222222222/gate",
			map[string]string{"gateVerdict": "approved"},
			headers,
		)
		if missingRes.StatusCode != http.StatusNotFound {
			t.Fatalf("expected 404 for nonexistent run gate override, got %d", missingRes.StatusCode)
		}
	})

	t.Run("POST /v1/admin/status returns 405 Method Not Allowed", func(t *testing.T) {
		adminToken, err := internalauth.Sign(internalauth.RoleAdmin, "admin-e2e", time.Minute, "")
		if err != nil {
			t.Fatalf("sign admin token: %v", err)
		}
		res, _ := e2etest.DoRequest(
			t,
			http.MethodPost,
			baseURL+"/v1/admin/status",
			nil,
			map[string]string{internalauth.HeaderName: adminToken},
		)
		if res.StatusCode != http.StatusMethodNotAllowed {
			t.Fatalf("expected 405, got %d", res.StatusCode)
		}
	})
}
