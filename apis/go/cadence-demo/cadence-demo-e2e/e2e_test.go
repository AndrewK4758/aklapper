package cadencedemo_e2e_test

import (
	"net/http"
	"strings"
	"testing"

	"github.com/AndrewK4758/aklapper/packages/go/contracts"
	"github.com/AndrewK4758/aklapper/packages/go/httpkit"
	"github.com/AndrewK4758/aklapper/packages/go/httpkit/e2etest"
)

type cadenceRunResponse struct {
	RunID        string                  `json:"runId"`
	Status       contracts.Osc7501Status `json:"status"`
	OSC7501      string                  `json:"osc7501"`
	GateVerdict  string                  `json:"gateVerdict"`
	ArtifactHTML string                  `json:"artifactHtml"`
	Quota        contracts.QuotaStatus   `json:"quota"`
}

func TestCadenceDemoEndToEnd(t *testing.T) {
	t.Parallel()

	baseURL := e2etest.StartBinary(t, "../cadence-demo")

	t.Run("GET /healthz returns cadence-demo health", func(t *testing.T) {
		res, health := e2etest.DoJSON[httpkit.HealthResponse](t, http.MethodGet, baseURL+"/healthz", nil, nil)
		if res.StatusCode != http.StatusOK || !health.OK || health.Service != "cadence-demo" {
			t.Fatalf("unexpected health response (status %d): %+v", res.StatusCode, health)
		}
	})

	t.Run("POST /v1/cadence/runs creates sandboxed artifact and escapes HTML", func(t *testing.T) {
		res, run := e2etest.DoJSON[cadenceRunResponse](
			t,
			http.MethodPost,
			baseURL+"/v1/cadence/runs",
			contracts.CadenceRunRequest{
				Prompt:     `Render <script>alert("xss")</script> telemetry panel`,
				PresetSlug: "solar-forge",
			},
			nil,
		)
		if res.StatusCode != http.StatusCreated {
			t.Fatalf("expected 201, got %d", res.StatusCode)
		}
		if !strings.HasPrefix(run.RunID, "run-") || run.GateVerdict != "pending" {
			t.Fatalf("unexpected run metadata: %+v", run)
		}
		if run.Status.Source != "cadence-demo" || run.Status.State != "ready" || run.Status.Progress == nil || *run.Status.Progress != 100 {
			t.Fatalf("unexpected OSC7501 status: %+v", run.Status)
		}
		if !strings.Contains(run.OSC7501, "7501;") {
			t.Fatalf("expected formatted OSC 7501 sequence, got %q", run.OSC7501)
		}
		if strings.Contains(run.ArtifactHTML, "<script>") || !strings.Contains(run.ArtifactHTML, "&lt;script&gt;") {
			t.Fatalf("expected escaped script tags in artifactHtml, got %q", run.ArtifactHTML)
		}
		if run.Quota.Role != contracts.RoleGuest || run.Quota.MaxTurns != 3 || run.Quota.MaxTokens != 12000 {
			t.Fatalf("unexpected guest quota: %+v", run.Quota)
		}
	})

	t.Run("POST /v1/cadence/runs rejects invalid JSON and invalid prompt lengths", func(t *testing.T) {
		resBadJSON, _ := e2etest.DoRequest(
			t,
			http.MethodPost,
			baseURL+"/v1/cadence/runs",
			[]byte("not-json"),
			map[string]string{"Content-Type": "application/json"},
		)
		if resBadJSON.StatusCode != http.StatusBadRequest {
			t.Fatalf("expected 400 for malformed JSON, got %d", resBadJSON.StatusCode)
		}

		resShort, _ := e2etest.DoJSON[httpkit.ErrorResponse](
			t,
			http.MethodPost,
			baseURL+"/v1/cadence/runs",
			contracts.CadenceRunRequest{Prompt: "abc"},
			nil,
		)
		if resShort.StatusCode != http.StatusBadRequest {
			t.Fatalf("expected 400 for short prompt, got %d", resShort.StatusCode)
		}

		resLong, _ := e2etest.DoJSON[httpkit.ErrorResponse](
			t,
			http.MethodPost,
			baseURL+"/v1/cadence/runs",
			contracts.CadenceRunRequest{Prompt: strings.Repeat("x", 1201)},
			nil,
		)
		if resLong.StatusCode != http.StatusBadRequest {
			t.Fatalf("expected 400 for oversized prompt, got %d", resLong.StatusCode)
		}
	})
}
