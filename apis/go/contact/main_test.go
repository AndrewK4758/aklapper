package main

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestContactEndpoint(t *testing.T) {
	t.Parallel()

	h := newHandler()
	req := httptest.NewRequest(
		http.MethodPost,
		"/v1/contact",
		bytes.NewBufferString(`{"name":"Andrew","email":"andrew@example.com","subject":"Hello","message":"Testing contact validation flow."}`),
	)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusAccepted {
		t.Fatalf("expected 202, got %d", rec.Code)
	}
}
