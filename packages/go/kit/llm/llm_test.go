package llm

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestLocalClientChatAndEmbed(t *testing.T) {
	t.Parallel()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/chat/completions":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"choices": []map[string]any{
					{"message": map[string]any{"content": "Solar Forge grounded response"}},
				},
				"usage": map[string]any{"total_tokens": 42},
			})
		case "/embeddings":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"data": []map[string]any{
					{"embedding": []float32{0.5, 0.25, 0.75}},
				},
			})
		default:
			http.NotFound(w, r)
		}
	}))
	defer srv.Close()

	client := &LocalClient{
		BaseURL:    srv.URL,
		HTTPClient: srv.Client(),
	}

	comp, err := client.Chat(context.Background(), []ChatMessage{{Role: "user", Content: "hello"}}, 128)
	if err != nil {
		t.Fatalf("Chat failed: %v", err)
	}
	if comp.Text != "Solar Forge grounded response" || comp.TokensUsed != 42 {
		t.Fatalf("unexpected completion: %+v", comp)
	}

	vec, err := client.Embed(context.Background(), "hello")
	if err != nil {
		t.Fatalf("Embed failed: %v", err)
	}
	if len(vec) != 3 {
		t.Fatalf("expected 3 dims, got %d", len(vec))
	}
	if DefaultLocalEmbedModel != "embedding" {
		t.Fatalf("expected DefaultLocalEmbedModel=embedding, got %q", DefaultLocalEmbedModel)
	}
	if err := ValidateEmbeddingDims(make([]float32, ExpectedEmbeddingDims)); err != nil {
		t.Fatalf("expected 768-dim zero vector to validate, got %v", err)
	}
	if err := ValidateEmbeddingDims([]float32{0.5, 0.25, 0.75}); err == nil {
		t.Fatal("expected dimension mismatch error for 3-dim vector")
	}
}

func TestVertexClientChatEmbedAndMetadataToken(t *testing.T) {
	t.Parallel()

	metaSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Metadata-Flavor") != "Google" {
			http.Error(w, "missing Metadata-Flavor", http.StatusForbidden)
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"access_token": "meta-tok-xyz"})
	}))
	defer metaSrv.Close()

	vertexSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer meta-tok-xyz" {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		switch r.URL.Path {
		case "/v1/projects/aklapper-prod/locations/us-central1/publishers/google/models/gemini-2.5-flash:generateContent":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"candidates": []map[string]any{
					{
						"content": map[string]any{
							"parts": []map[string]any{{"text": "Vertex grounded output"}},
						},
					},
				},
				"usageMetadata": map[string]any{
					"promptTokenCount":     14,
					"candidatesTokenCount": 9,
				},
			})
		case "/v1/projects/aklapper-prod/locations/us-central1/publishers/google/models/text-embedding-005:predict":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"predictions": []map[string]any{
					{"embeddings": map[string]any{"values": []float32{0.1, 0.2, 0.3, 0.4}}},
				},
			})
		default:
			http.NotFound(w, r)
		}
	}))
	defer vertexSrv.Close()

	client := &VertexClient{
		ProjectID:       "aklapper-prod",
		Location:        "us-central1",
		Model:           "gemini-2.5-flash",
		EmbedModel:      "text-embedding-005",
		MetadataURL:     metaSrv.URL,
		EndpointBaseURL: vertexSrv.URL,
		HTTPClient:      vertexSrv.Client(),
	}

	comp, err := client.Chat(context.Background(), []ChatMessage{
		{Role: "system", Content: "Stay grounded"},
		{Role: "user", Content: "Hello"},
	}, 200)
	if err != nil {
		t.Fatalf("Vertex Chat failed: %v", err)
	}
	if comp.Text != "Vertex grounded output" || comp.TokensUsed != 23 || comp.Model != "gemini-2.5-flash" {
		t.Fatalf("unexpected Vertex completion: %+v", comp)
	}

	vec, err := client.Embed(context.Background(), "Solar Forge")
	if err != nil {
		t.Fatalf("Vertex Embed failed: %v", err)
	}
	if len(vec) != 4 {
		t.Fatalf("expected 4 dims, got %d", len(vec))
	}
}

func TestVertexClientFailsClearlyWhenMetadataUnreachable(t *testing.T) {
	t.Parallel()

	client := &VertexClient{
		ProjectID:   "aklapper-prod",
		Location:    "us-central1",
		MetadataURL: "http://127.0.0.1:1/unreachable",
	}
	if _, err := client.Chat(context.Background(), []ChatMessage{{Role: "user", Content: "hi"}}, 64); err == nil {
		t.Fatal("expected clear error when metadata server is unreachable")
	}
}
