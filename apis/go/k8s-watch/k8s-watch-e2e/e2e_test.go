package k8swatch_e2e_test

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
	"github.com/AndrewK4758/aklapper/packages/go/kit/httpkit"
	"github.com/AndrewK4758/aklapper/packages/go/kit/httpkit/e2etest"
	"github.com/AndrewK4758/aklapper/packages/go/kit/internalauth"
)

type wakeResponse struct {
	Event   contracts.K8sPodEvent `json:"event"`
	OSC7501 string                `json:"osc7501"`
}

func parseSSEPodEvents(t *testing.T, body []byte) []contracts.K8sPodEvent {
	t.Helper()
	var events []contracts.K8sPodEvent
	for _, line := range strings.Split(string(body), "\n") {
		if !strings.HasPrefix(line, "data: ") {
			continue
		}
		var ev contracts.K8sPodEvent
		if err := json.Unmarshal([]byte(strings.TrimPrefix(line, "data: ")), &ev); err != nil {
			t.Fatalf("decode SSE event %q: %v", line, err)
		}
		events = append(events, ev)
	}
	return events
}

func TestK8sWatchEndToEnd(t *testing.T) {
	t.Parallel()

	baseURL := e2etest.StartBinary(t, "../k8s-watch")

	t.Run("GET /healthz returns k8s-watch health", func(t *testing.T) {
		res, health := e2etest.DoJSON[httpkit.HealthResponse](t, http.MethodGet, baseURL+"/healthz", nil, nil)
		if res.StatusCode != http.StatusOK || !health.OK || health.Service != "k8s-watch" {
			t.Fatalf("unexpected health response (status %d): %+v", res.StatusCode, health)
		}
	})

	serviceTok, err := internalauth.Sign(internalauth.RoleService, "portal-ssr", time.Minute, "")
	if err != nil {
		t.Fatalf("sign service token: %v", err)
	}

	t.Run("GET /v1/cluster/stream rejects unauthenticated requests and streams portfolio-public workloads", func(t *testing.T) {
		resUnauth, _ := e2etest.DoRequest(
			t,
			http.MethodGet,
			baseURL+"/v1/cluster/stream",
			nil,
			map[string]string{"X-Admin-Role": contracts.RoleAdmin},
		)
		if resUnauth.StatusCode != http.StatusUnauthorized {
			t.Fatalf("expected 401 without signed X-Internal-Auth, got %d", resUnauth.StatusCode)
		}

		res, body := e2etest.DoRequest(
			t,
			http.MethodGet,
			baseURL+"/v1/cluster/stream",
			nil,
			map[string]string{
				internalauth.HeaderName: serviceTok,
			},
		)
		if res.StatusCode != http.StatusOK {
			t.Fatalf("expected 200, got %d", res.StatusCode)
		}
		if ct := res.Header.Get("Content-Type"); !strings.HasPrefix(ct, "text/event-stream") {
			t.Fatalf("expected text/event-stream Content-Type, got %q", ct)
		}
		if cc := res.Header.Get("Cache-Control"); cc != "no-cache" {
			t.Fatalf("expected Cache-Control: no-cache, got %q", cc)
		}

		events := parseSSEPodEvents(t, body)
		if len(events) != 2 {
			t.Fatalf("expected 2 portfolio-public events, got %d (%+v)", len(events), events)
		}
		if events[0].Deployment != "cadence-demo" || events[0].Namespace != contracts.PublicNamespace {
			t.Fatalf("unexpected first event: %+v", events[0])
		}
		if events[1].Deployment != "ai-ask" || events[1].Namespace != contracts.PublicNamespace {
			t.Fatalf("unexpected second event: %+v", events[1])
		}
	})

	t.Run("POST /v1/cluster/wake/{deployment} enforces signed internal auth and emits OSC7501 status", func(t *testing.T) {
		resWakeUnauth, _ := e2etest.DoJSON[httpkit.ErrorResponse](
			t,
			http.MethodPost,
			baseURL+"/v1/cluster/wake/cadence-demo",
			nil,
			nil,
		)
		if resWakeUnauth.StatusCode != http.StatusUnauthorized {
			t.Fatalf("expected 401 for unauthenticated public wake, got %d", resWakeUnauth.StatusCode)
		}

		resPublic, wakePublic := e2etest.DoJSON[wakeResponse](
			t,
			http.MethodPost,
			baseURL+"/v1/cluster/wake/cadence-demo",
			nil,
			map[string]string{internalauth.HeaderName: serviceTok},
		)
		if resPublic.StatusCode != http.StatusAccepted {
			t.Fatalf("expected 202 for public wake, got %d", resPublic.StatusCode)
		}
		if wakePublic.Event.Namespace != contracts.PublicNamespace || wakePublic.Event.Phase != "TriggeredScaleUp" {
			t.Fatalf("unexpected public wake event: %+v", wakePublic.Event)
		}
		if !strings.Contains(wakePublic.OSC7501, "7501;") {
			t.Fatalf("expected OSC7501 sequence, got %q", wakePublic.OSC7501)
		}
	})
}
