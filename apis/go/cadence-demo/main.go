package main

import (
	"encoding/json"
	"fmt"
	"html"
	"log"
	"net/http"
	"time"

	"github.com/AndrewK4758/aklapper/packages/go/contracts"
	"github.com/AndrewK4758/aklapper/packages/go/httpkit"
	"github.com/AndrewK4758/aklapper/packages/go/k8sevents"
)

func buildStarterArtifactHTML(prompt string) string {
	safePrompt := html.EscapeString(prompt)
	return fmt.Sprintf(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>CADENCE Sandbox Artifact</title>
<style>
  body { margin: 0; font-family: monospace; background: #141311; color: #f4efe6; padding: 1.5rem; }
  .card { border: 1px solid #f59e0b; border-radius: 6px; padding: 1rem; background: #1c1a17; }
  .badge { color: #f59e0b; font-size: 0.75rem; letter-spacing: 0.08em; text-transform: uppercase; }
  h1 { margin: 0.5rem 0; font-size: 1.1rem; }
  p { color: #b9b0a2; line-height: 1.5; }
</style>
</head>
<body>
  <main class="card">
    <div class="badge">CADENCE · CHORD SANDBOX ARTIFACT</div>
    <h1>%s</h1>
    <p>Generated under guest quota guardrails inside an isolated iframe sandbox.</p>
  </main>
</body>
</html>`, safePrompt)
}

func newHandler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", httpkit.NewHealthHandler("cadence-demo"))

	mux.HandleFunc("POST /v1/cadence/runs", func(w http.ResponseWriter, r *http.Request) {
		var req contracts.CadenceRunRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			httpkit.WriteError(w, http.StatusBadRequest, "invalid JSON payload")
			return
		}
		if err := req.Validate(); err != nil {
			httpkit.WriteError(w, http.StatusBadRequest, err.Error())
			return
		}

		pct := 100
		status := contracts.Osc7501Status{
			Source:    "cadence-demo",
			State:     "ready",
			Label:     "CHORD spec + sandbox artifact ready",
			Progress:  &pct,
			Timestamp: time.Now().UTC(),
		}

		httpkit.WriteJSON(w, http.StatusCreated, map[string]any{
			"runId":        fmt.Sprintf("run-%d", time.Now().UTC().UnixNano()),
			"status":       status,
			"osc7501":      k8sevents.FormatOSC7501(status),
			"gateVerdict":  "pending",
			"artifactHtml": buildStarterArtifactHTML(req.Prompt),
			"quota": contracts.QuotaStatus{
				Role:       contracts.RoleGuest,
				TurnsUsed:  1,
				MaxTurns:   3,
				TokensUsed: 640,
				MaxTokens:  12000,
			},
		})
	})

	return mux
}

func main() {
	addr := httpkit.ListenAddr("8082")
	log.Printf("cadence-demo listening on %s", addr)
	if err := httpkit.ListenAndServeGraceful(addr, newHandler()); err != nil {
		log.Fatal(err)
	}
}
