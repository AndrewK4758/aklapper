package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestCadenceRunValidationAndEscape(t *testing.T) {
	t.Parallel()

	h := newHandler()

	// Reject short prompt
	badReq := httptest.NewRequest(http.MethodPost, "/v1/cadence/runs", bytes.NewBufferString(`{"prompt":"no"}`))
	badRec := httptest.NewRecorder()
	h.ServeHTTP(badRec, badReq)
	if badRec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", badRec.Code)
	}

	// Accept valid prompt and escape HTML
	goodReq := httptest.NewRequest(http.MethodPost, "/v1/cadence/runs", bytes.NewBufferString(`{"prompt":"Build <script>alert(1)</script> widget"}`))
	goodRec := httptest.NewRecorder()
	h.ServeHTTP(goodRec, goodReq)
	if goodRec.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d", goodRec.Code)
	}

	var payload map[string]any
	if err := json.NewDecoder(goodRec.Body).Decode(&payload); err != nil {
		t.Fatalf("decode failed: %v", err)
	}
	artifact, _ := payload["artifactHtml"].(string)
	if strings.Contains(artifact, "<script>") {
		t.Fatalf("expected HTML escaping of prompt, got %s", artifact)
	}
}
