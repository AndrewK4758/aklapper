package cadencedemo_e2e_test

import (
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
	"github.com/AndrewK4758/aklapper/packages/go/kit/httpkit"
	"github.com/AndrewK4758/aklapper/packages/go/kit/httpkit/e2etest"
	"github.com/AndrewK4758/aklapper/packages/go/kit/internalauth"
)

type cadenceRunResponse struct {
	RunID        string                  `json:"runId"`
	Prompt       string                  `json:"prompt"`
	PresetSlug   string                  `json:"presetSlug"`
	Status       contracts.Osc7501Status `json:"status"`
	OSC7501      string                  `json:"osc7501"`
	GateVerdict  string                  `json:"gateVerdict"`
	Turns        []contracts.CadenceTurn `json:"turns"`
	ArtifactHTML string                  `json:"artifactHtml"`
	Quota        contracts.QuotaStatus   `json:"quota"`
}

func TestCadenceDemoEndToEnd(t *testing.T) {
	t.Parallel()

	baseURL := e2etest.StartBinary(
		t,
		"../cadence-demo",
		"PG_DISABLE_LIVE=true",
		"LOCAL_LLM_BASE_URL=http://127.0.0.1:1/v1",
		"QDRANT_URL=http://127.0.0.1:1",
	)

	t.Run("GET /healthz returns cadence-demo health", func(t *testing.T) {
		res, health := e2etest.DoJSON[httpkit.HealthResponse](t, http.MethodGet, baseURL+"/healthz", nil, nil)
		if res.StatusCode != http.StatusOK || !health.OK || health.Service != "cadence-demo" {
			t.Fatalf("unexpected health response (status %d): %+v", res.StatusCode, health)
		}
	})

	guestTok, err := internalauth.Sign(internalauth.RoleGuest, "e2e-cadence-1", time.Minute, "")
	if err != nil {
		t.Fatalf("sign guest token: %v", err)
	}
	guestHeaders := map[string]string{internalauth.HeaderName: guestTok}

	t.Run("rejects unauthenticated callers across run and gate endpoints", func(t *testing.T) {
		resList, _ := e2etest.DoJSON[httpkit.ErrorResponse](t, http.MethodGet, baseURL+"/v1/cadence/runs?limit=50", nil, nil)
		if resList.StatusCode != http.StatusUnauthorized {
			t.Fatalf("expected 401 without internal auth, got %d", resList.StatusCode)
		}

		resCreate, _ := e2etest.DoJSON[httpkit.ErrorResponse](
			t,
			http.MethodPost,
			baseURL+"/v1/cadence/runs",
			contracts.CadenceRunRequest{Prompt: "Unauthenticated run"},
			nil,
		)
		if resCreate.StatusCode != http.StatusUnauthorized {
			t.Fatalf("expected 401 for unauthenticated run creation, got %d", resCreate.StatusCode)
		}
	})

	var createdRunID string
	t.Run("POST /v1/cadence/runs creates 4-phase CHORD sandbox artifact and escapes HTML", func(t *testing.T) {
		res, run := e2etest.DoJSON[cadenceRunResponse](
			t,
			http.MethodPost,
			baseURL+"/v1/cadence/runs",
			contracts.CadenceRunRequest{
				Prompt:     `Render <script>alert("xss")</script> telemetry panel`,
				PresetSlug: "solar-forge-starter",
				SessionID:  "e2e-cadence-1",
			},
			guestHeaders,
		)
		if res.StatusCode != http.StatusCreated {
			t.Fatalf("expected 201, got %d", res.StatusCode)
		}
		createdRunID = run.RunID
		if run.RunID == "" || run.GateVerdict != "pending" {
			t.Fatalf("unexpected run metadata: %+v", run)
		}
		if len(run.Turns) != 4 {
			t.Fatalf("expected 4 CHORD turns, got %d", len(run.Turns))
		}
		if run.Status.Source != "cadence-demo" || run.Status.State != "ready" || run.Status.Progress == nil || *run.Status.Progress != 100 {
			t.Fatalf("unexpected OSC7501 status: %+v", run.Status)
		}
		if !strings.Contains(run.OSC7501, "7501;") {
			t.Fatalf("expected formatted OSC 7501 sequence, got %q", run.OSC7501)
		}
		if strings.Contains(run.ArtifactHTML, `<script>alert`) || !strings.Contains(run.ArtifactHTML, "&lt;script&gt;") {
			t.Fatalf("expected escaped script tags in artifactHtml, got %q", run.ArtifactHTML)
		}
		if run.Quota.Role != contracts.RoleGuest || run.Quota.TurnsUsed != 1 || run.Quota.MaxTurns != 5 {
			t.Fatalf("unexpected guest quota: %+v", run.Quota)
		}
	})

	t.Run("POST /v1/cadence/runs/{id}/gate enforces internal auth and X-Session-Id, persists verdict, and GET /v1/cadence/runs lists it", func(t *testing.T) {
		resGateUnauth, _ := e2etest.DoJSON[httpkit.ErrorResponse](
			t,
			http.MethodPost,
			baseURL+"/v1/cadence/runs/"+createdRunID+"/gate",
			map[string]string{"verdict": "approved"},
			nil,
		)
		if resGateUnauth.StatusCode != http.StatusUnauthorized {
			t.Fatalf("expected 401 without internal auth on gate update, got %d", resGateUnauth.StatusCode)
		}

		resNoSessGate, _ := e2etest.DoJSON[httpkit.ErrorResponse](
			t,
			http.MethodPost,
			baseURL+"/v1/cadence/runs/"+createdRunID+"/gate",
			map[string]string{"verdict": "approved"},
			guestHeaders,
		)
		if resNoSessGate.StatusCode != http.StatusUnauthorized {
			t.Fatalf("expected 401 when X-Session-Id is omitted on gate update, got %d", resNoSessGate.StatusCode)
		}

		resGate, gateOut := e2etest.DoJSON[map[string]any](
			t,
			http.MethodPost,
			baseURL+"/v1/cadence/runs/"+createdRunID+"/gate",
			map[string]string{"verdict": "approved"},
			map[string]string{
				internalauth.HeaderName: guestTok,
				"X-Session-Id":          "e2e-cadence-1",
			},
		)
		if resGate.StatusCode != http.StatusOK || gateOut["gateVerdict"] != "approved" {
			t.Fatalf("expected 200 approved, got (%d): %+v", resGate.StatusCode, gateOut)
		}

		resNoSess, _ := e2etest.DoJSON[httpkit.ErrorResponse](t, http.MethodGet, baseURL+"/v1/cadence/runs?limit=50", nil, guestHeaders)
		if resNoSess.StatusCode != http.StatusBadRequest {
			t.Fatalf("expected 400 when non-admin caller omits sessionId, got %d", resNoSess.StatusCode)
		}

		resList, listOut := e2etest.DoJSON[struct {
			Runs  []map[string]any      `json:"runs"`
			Quota contracts.QuotaStatus `json:"quota"`
		}](t, http.MethodGet, baseURL+"/v1/cadence/runs?sessionId=e2e-cadence-1", nil, guestHeaders)
		if resList.StatusCode != http.StatusOK || len(listOut.Runs) != 1 {
			t.Fatalf("expected 1 run in history, got (%d): %+v", resList.StatusCode, listOut)
		}
		if listOut.Runs[0]["gateVerdict"] != "approved" {
			t.Fatalf("expected approved gate verdict in history: %+v", listOut.Runs[0])
		}
	})

	t.Run("POST /v1/cadence/runs enforces guest session quota with HTTP 429", func(t *testing.T) {
		for i := range 5 {
			res, _ := e2etest.DoJSON[cadenceRunResponse](
				t,
				http.MethodPost,
				baseURL+"/v1/cadence/runs",
				contracts.CadenceRunRequest{
					Prompt:    "Quota enforcement check prompt",
					SessionID: "e2e-quota-cap",
				},
				guestHeaders,
			)
			if res.StatusCode != http.StatusCreated {
				t.Fatalf("run %d expected 201, got %d", i+1, res.StatusCode)
			}
		}
		resOver, body := e2etest.DoJSON[map[string]any](
			t,
			http.MethodPost,
			baseURL+"/v1/cadence/runs",
			contracts.CadenceRunRequest{
				Prompt:    "Sixth run should exceed guest quota",
				SessionID: "e2e-quota-cap",
			},
			guestHeaders,
		)
		if resOver.StatusCode != http.StatusTooManyRequests || body["quota"] == nil {
			t.Fatalf("expected 429 with quota payload, got (%d): %+v", resOver.StatusCode, body)
		}
	})

	t.Run("two-phase deferExecution init + SSE stream + session gate works end-to-end", func(t *testing.T) {
		resInit, initRun := e2etest.DoJSON[contracts.CadenceRunResult](
			t,
			http.MethodPost,
			baseURL+"/v1/cadence/runs",
			contracts.CadenceRunRequest{
				Prompt:         "Render GKE scale-from-zero telemetry card with latency probe",
				PresetSlug:     "k8s-pod-telemetry",
				SessionID:      "e2e-stream-1",
				Mode:           contracts.CadenceModeFast,
				DeferExecution: true,
			},
			guestHeaders,
		)
		if resInit.StatusCode != http.StatusAccepted || initRun.RunStatus != contracts.CadenceStatusPending {
			t.Fatalf("expected 202 pending run, got (%d): %+v", resInit.StatusCode, initRun)
		}

		resNoToken, _ := e2etest.DoRequest(t, http.MethodGet, baseURL+"/v1/cadence/runs/"+initRun.RunID+"/stream", nil, map[string]string{"X-Session-Id": "e2e-stream-1"})
		if resNoToken.StatusCode != http.StatusUnauthorized {
			t.Fatalf("expected 401 without internal auth on stream, got %d", resNoToken.StatusCode)
		}

		resMissing, _ := e2etest.DoRequest(t, http.MethodGet, baseURL+"/v1/cadence/runs/"+initRun.RunID+"/stream", nil, guestHeaders)
		if resMissing.StatusCode != http.StatusUnauthorized {
			t.Fatalf("expected 401 without X-Session-Id, got %d", resMissing.StatusCode)
		}

		resWrong, _ := e2etest.DoRequest(t, http.MethodGet, baseURL+"/v1/cadence/runs/"+initRun.RunID+"/stream", nil, map[string]string{
			internalauth.HeaderName: guestTok,
			"X-Session-Id":          "e2e-other",
		})
		if resWrong.StatusCode != http.StatusForbidden {
			t.Fatalf("expected 403 for wrong X-Session-Id, got %d", resWrong.StatusCode)
		}

		resStream, streamBytes := e2etest.DoRequest(t, http.MethodGet, baseURL+"/v1/cadence/runs/"+initRun.RunID+"/stream", nil, map[string]string{
			internalauth.HeaderName: guestTok,
			"X-Session-Id":          "e2e-stream-1",
		})
		streamText := string(streamBytes)
		if resStream.StatusCode != http.StatusOK || !strings.Contains(streamText, "event: phase") || !strings.Contains(streamText, "event: complete") || !strings.Contains(streamText, "k8s-pod-telemetry") {
			t.Fatalf("unexpected SSE stream response (%d): %s", resStream.StatusCode, streamText)
		}

		resGate, gateBody := e2etest.DoJSON[struct {
			Run contracts.CadenceRunResult `json:"run"`
		}](
			t,
			http.MethodPost,
			baseURL+"/v1/cadence/runs/"+initRun.RunID+"/gate",
			map[string]string{"verdict": "approved"},
			map[string]string{
				internalauth.HeaderName: guestTok,
				"X-Session-Id":          "e2e-stream-1",
			},
		)
		if resGate.StatusCode != http.StatusOK || gateBody.Run.GateVerdict != "approved" || gateBody.Run.RunStatus != contracts.CadenceStatusReady {
			t.Fatalf("unexpected gate result (%d): %+v", resGate.StatusCode, gateBody)
		}
	})

	t.Run("POST /v1/cadence/runs rejects invalid JSON and invalid prompt lengths", func(t *testing.T) {
		resBadJSON, _ := e2etest.DoRequest(
			t,
			http.MethodPost,
			baseURL+"/v1/cadence/runs",
			[]byte("not-json"),
			map[string]string{
				"Content-Type":          "application/json",
				internalauth.HeaderName: guestTok,
			},
		)
		if resBadJSON.StatusCode != http.StatusBadRequest {
			t.Fatalf("expected 400 for malformed JSON, got %d", resBadJSON.StatusCode)
		}

		resShort, _ := e2etest.DoJSON[httpkit.ErrorResponse](
			t,
			http.MethodPost,
			baseURL+"/v1/cadence/runs",
			contracts.CadenceRunRequest{Prompt: "abc"},
			guestHeaders,
		)
		if resShort.StatusCode != http.StatusBadRequest {
			t.Fatalf("expected 400 for short prompt, got %d", resShort.StatusCode)
		}

		resLong, _ := e2etest.DoJSON[httpkit.ErrorResponse](
			t,
			http.MethodPost,
			baseURL+"/v1/cadence/runs",
			contracts.CadenceRunRequest{Prompt: strings.Repeat("x", 1201)},
			guestHeaders,
		)
		if resLong.StatusCode != http.StatusBadRequest {
			t.Fatalf("expected 400 for oversized prompt, got %d", resLong.StatusCode)
		}
	})
}
