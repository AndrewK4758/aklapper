package main

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/AndrewK4758/aklapper/packages/go/kit/contracts"
	"github.com/AndrewK4758/aklapper/packages/go/kit/internalauth"
	"github.com/AndrewK4758/aklapper/packages/go/kit/pg"
)

func signAdminToken(t *testing.T) string {
	t.Helper()
	token, err := internalauth.Sign(internalauth.RoleAdmin, "admin-unit", time.Minute, "")
	if err != nil {
		t.Fatalf("sign admin token: %v", err)
	}
	return token
}

func TestAdminEndpointsRequireSignedInternalAuth(t *testing.T) {
	t.Parallel()

	h := newHandler(pg.NewMemoryStore())
	endpoints := []struct {
		method string
		path   string
	}{
		{http.MethodGet, "/v1/admin/status"},
		{http.MethodGet, "/v1/admin/runs"},
		{http.MethodPost, "/v1/admin/runs/11111111-1111-4111-8111-111111111111/gate"},
	}

	for _, ep := range endpoints {
		guestReq := httptest.NewRequest(ep.method, ep.path, nil)
		guestRec := httptest.NewRecorder()
		h.ServeHTTP(guestRec, guestReq)
		if guestRec.Code != http.StatusForbidden {
			t.Fatalf("%s %s: expected 403 for guest, got %d", ep.method, ep.path, guestRec.Code)
		}

		spoofReq := httptest.NewRequest(ep.method, ep.path, nil)
		spoofReq.Header.Set("X-Admin-Role", "admin")
		spoofRec := httptest.NewRecorder()
		h.ServeHTTP(spoofRec, spoofReq)
		if spoofRec.Code != http.StatusForbidden {
			t.Fatalf("%s %s: expected 403 for spoofed X-Admin-Role header, got %d", ep.method, ep.path, spoofRec.Code)
		}
	}
}

func TestAdminStatusRunsAndGateOverride(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	store := pg.NewMemoryStore()
	runID, err := store.CreateSandboxRun(ctx, pg.SandboxRunInput{
		SessionID:    "sess-admin-test",
		MenuSlug:     "cadence",
		Prompt:       "Inspect sandbox orchestration",
		Status:       "ready",
		GateVerdict:  "pending",
		TokensIn:     200,
		TokensOut:    500,
		ArtifactHTML: "<html><body>ok</body></html>",
	})
	if err != nil {
		t.Fatalf("CreateSandboxRun: %v", err)
	}
	if _, err := store.InsertSandboxTurn(ctx, pg.SandboxTurnInput{
		RunID:     runID,
		Phase:     "triage",
		AgentName: "chord-triage",
		Status:    "completed",
		Summary:   "Scoped prompt",
		LatencyMs: 12,
	}); err != nil {
		t.Fatalf("InsertSandboxTurn: %v", err)
	}

	h := newHandler(store)
	token := signAdminToken(t)

	// GET /v1/admin/status
	statusReq := httptest.NewRequest(http.MethodGet, "/v1/admin/status", nil)
	statusReq.Header.Set(internalauth.HeaderName, token)
	statusRec := httptest.NewRecorder()
	h.ServeHTTP(statusRec, statusReq)
	if statusRec.Code != http.StatusOK {
		t.Fatalf("expected 200 for status, got %d", statusRec.Code)
	}
	var statusBody struct {
		Namespace         string `json:"namespace"`
		Isolated          bool   `json:"isolated"`
		Mode              string `json:"mode"`
		DatabaseConnected bool   `json:"databaseConnected"`
		TotalSandboxRuns  int    `json:"totalSandboxRuns"`
		PendingGates      int    `json:"pendingGates"`
		Timestamp         string `json:"timestamp"`
	}
	if err := json.Unmarshal(statusRec.Body.Bytes(), &statusBody); err != nil {
		t.Fatalf("decode status: %v", err)
	}
	if statusBody.Namespace != contracts.AdminNamespace || !statusBody.Isolated || statusBody.TotalSandboxRuns != 1 || statusBody.PendingGates != 1 {
		t.Fatalf("unexpected status payload: %+v", statusBody)
	}

	// GET /v1/admin/runs
	runsReq := httptest.NewRequest(http.MethodGet, "/v1/admin/runs?limit=10", nil)
	runsReq.Header.Set(internalauth.HeaderName, token)
	runsRec := httptest.NewRecorder()
	h.ServeHTTP(runsRec, runsReq)
	if runsRec.Code != http.StatusOK {
		t.Fatalf("expected 200 for runs, got %d", runsRec.Code)
	}
	var runsBody struct {
		Runs  []pg.SandboxRun `json:"runs"`
		Count int             `json:"count"`
	}
	if err := json.Unmarshal(runsRec.Body.Bytes(), &runsBody); err != nil {
		t.Fatalf("decode runs: %v", err)
	}
	if runsBody.Count != 1 || len(runsBody.Runs) != 1 || len(runsBody.Runs[0].Turns) != 1 {
		t.Fatalf("unexpected runs payload: %+v", runsBody)
	}

	// POST /v1/admin/runs/{id}/gate -> approved
	approveReq := httptest.NewRequest(http.MethodPost, "/v1/admin/runs/"+runID+"/gate", bytes.NewBufferString(`{"gateVerdict":"approved"}`))
	approveReq.Header.Set(internalauth.HeaderName, token)
	approveRec := httptest.NewRecorder()
	h.ServeHTTP(approveRec, approveReq)
	if approveRec.Code != http.StatusOK {
		t.Fatalf("expected 200 for gate override, got %d (%s)", approveRec.Code, approveRec.Body.String())
	}
	var updated pg.SandboxRun
	if err := json.Unmarshal(approveRec.Body.Bytes(), &updated); err != nil {
		t.Fatalf("decode updated run: %v", err)
	}
	if updated.GateVerdict != "approved" {
		t.Fatalf("expected gateVerdict=approved, got %q", updated.GateVerdict)
	}

	// POST /v1/admin/runs/{id}/gate -> pending (valid admin override)
	pendingReq := httptest.NewRequest(http.MethodPost, "/v1/admin/runs/"+runID+"/gate", bytes.NewBufferString(`{"gateVerdict":"pending"}`))
	pendingReq.Header.Set(internalauth.HeaderName, token)
	pendingRec := httptest.NewRecorder()
	h.ServeHTTP(pendingRec, pendingReq)
	if pendingRec.Code != http.StatusOK {
		t.Fatalf("expected 200 for pending override, got %d", pendingRec.Code)
	}

	// Invalid verdict -> 400
	badReq := httptest.NewRequest(http.MethodPost, "/v1/admin/runs/"+runID+"/gate", bytes.NewBufferString(`{"gateVerdict":"invalid"}`))
	badReq.Header.Set(internalauth.HeaderName, token)
	badRec := httptest.NewRecorder()
	h.ServeHTTP(badRec, badReq)
	if badRec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for invalid verdict, got %d", badRec.Code)
	}

	// Missing run -> 404
	missingReq := httptest.NewRequest(http.MethodPost, "/v1/admin/runs/22222222-2222-4222-8222-222222222222/gate", bytes.NewBufferString(`{"gateVerdict":"rejected"}`))
	missingReq.Header.Set(internalauth.HeaderName, token)
	missingRec := httptest.NewRecorder()
	h.ServeHTTP(missingRec, missingReq)
	if missingRec.Code != http.StatusNotFound {
		t.Fatalf("expected 404 for missing run, got %d", missingRec.Code)
	}
}
