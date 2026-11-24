package main

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/AndrewK4758/aklapper/packages/go/kit/llm"
	"github.com/AndrewK4758/aklapper/packages/go/kit/qdrant"
)

type stubProvider struct{}

func (stubProvider) Name() string { return "stub" }
func (stubProvider) Chat(_ context.Context, _ []llm.ChatMessage, _ int) (llm.Completion, error) {
	return llm.Completion{Text: "Grounded answer", TokensUsed: 25, Model: "stub-model"}, nil
}
func (stubProvider) Embed(_ context.Context, _ string) ([]float32, error) {
	return []float32{0.1, 0.2, 0.3}, nil
}

func TestAskAbstainsWhenZeroHits(t *testing.T) {
	t.Parallel()

	qd := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{"result": []any{}})
	}))
	defer qd.Close()

	h := newHandler(stubProvider{}, &qdrant.Client{BaseURL: qd.URL, HTTPClient: qd.Client()})
	req := httptest.NewRequest(http.MethodPost, "/v1/ask", bytes.NewBufferString(`{"question":"What is Andrew's favorite stack?"}`))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	var payload map[string]any
	if err := json.NewDecoder(rec.Body).Decode(&payload); err != nil {
		t.Fatalf("decode failed: %v", err)
	}
	if grounded, _ := payload["grounded"].(bool); grounded {
		t.Fatal("expected grounded=false when vector store returns zero hits")
	}
}
