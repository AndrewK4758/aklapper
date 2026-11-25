package llm

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestLocalClientChatAndEmbed(t *testing.T) {
	t.Parallel()

	var capturedEmbedModel string
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
			var req struct {
				Model string `json:"model"`
			}
			_ = json.NewDecoder(r.Body).Decode(&req)
			capturedEmbedModel = req.Model
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
	if capturedEmbedModel != "embedding" {
		t.Fatalf("expected default embed model %q, got %q", "embedding", capturedEmbedModel)
	}
	if err := ValidateEmbeddingDims(make([]float32, ExpectedEmbeddingDims)); err != nil {
		t.Fatalf("expected 768-dim zero vector to validate, got %v", err)
	}
	if err := ValidateEmbeddingDims([]float32{0.5, 0.25, 0.75}); err == nil {
		t.Fatal("expected dimension mismatch error for 3-dim vector")
	}
}

func TestLocalClientEmbedRejectsEmptyVector(t *testing.T) {
	t.Parallel()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/embeddings" {
			_ = json.NewEncoder(w).Encode(map[string]any{
				"data": []map[string]any{
					{"embedding": []float32{}},
				},
			})
			return
		}
		http.NotFound(w, r)
	}))
	defer srv.Close()

	client := &LocalClient{BaseURL: srv.URL, HTTPClient: srv.Client()}
	if _, err := client.Embed(context.Background(), "hello"); err == nil {
		t.Fatal("expected error when local embedder returns an empty vector")
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

func TestVertexClientEmbedContent768AndLegacyPredict(t *testing.T) {
	var logs strings.Builder
	prevOut := log.Writer()
	log.SetOutput(&logs)
	defer log.SetOutput(prevOut)

	vec768 := make([]float32, ExpectedEmbeddingDims)
	for i := range vec768 {
		vec768[i] = 0.01
	}

	var capturedPath string
	var capturedBody map[string]any
	var returnValues []float32
	var forceStatus int

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		capturedPath = r.URL.Path
		capturedBody = nil
		_ = json.NewDecoder(r.Body).Decode(&capturedBody)
		if forceStatus != 0 {
			http.Error(w, "upstream failure", forceStatus)
			return
		}
		if strings.HasSuffix(r.URL.Path, ":embedContent") {
			_ = json.NewEncoder(w).Encode(map[string]any{
				"embedding": map[string]any{
					"values": returnValues,
				},
			})
			return
		}
		if strings.HasSuffix(r.URL.Path, ":predict") {
			_ = json.NewEncoder(w).Encode(map[string]any{
				"predictions": []map[string]any{
					{"embeddings": map[string]any{"values": returnValues}},
				},
			})
			return
		}
		http.NotFound(w, r)
	}))
	defer srv.Close()

	// 1. gemini-embedding-2 -> :embedContent with config.outputDimensionality=768
	returnValues = vec768
	client := &VertexClient{
		ProjectID:       "games-424800",
		Location:        "global",
		EmbedModel:      "gemini-embedding-2",
		AccessToken:     "secret-oauth-token",
		EndpointBaseURL: srv.URL,
		HTTPClient:      srv.Client(),
	}
	got, err := client.Embed(context.Background(), "hello")
	if err != nil {
		t.Fatalf("Embed gemini-embedding-2 failed: %v", err)
	}
	if len(got) != ExpectedEmbeddingDims {
		t.Fatalf("expected %d dims, got %d", ExpectedEmbeddingDims, len(got))
	}
	if err := ValidateEmbeddingDims(got); err != nil {
		t.Fatalf("ValidateEmbeddingDims failed: %v", err)
	}
	if capturedPath != "/v1/projects/games-424800/locations/global/publishers/google/models/gemini-embedding-2:embedContent" {
		t.Fatalf("unexpected embedContent path: %q", capturedPath)
	}
	if capturedBody["outputDimensionality"] != float64(ExpectedEmbeddingDims) {
		t.Fatalf("expected top-level outputDimensionality=768, got %#v", capturedBody)
	}
	if _, hasConfig := capturedBody["config"]; hasConfig {
		t.Fatalf("expected no nested config field in :embedContent payload, got %#v", capturedBody)
	}
	content, _ := capturedBody["content"].(map[string]any)
	parts, _ := content["parts"].([]any)
	if len(parts) != 1 || parts[0].(map[string]any)["text"] != "hello" {
		t.Fatalf("unexpected content.parts payload: %#v", capturedBody)
	}

	// 2. Empty :embedContent response returns ErrEmptyEmbedding BEFORE ValidateEmbeddingDims
	returnValues = []float32{}
	if _, err := client.Embed(context.Background(), "empty"); !errors.Is(err, ErrEmptyEmbedding) {
		t.Fatalf("expected ErrEmptyEmbedding for empty :embedContent vector, got %v", err)
	}

	// 3. Wrong-dim (3072) :embedContent response fails closed and logs BOUNDARY_FAULT
	returnValues = make([]float32, 3072)
	if _, err := client.Embed(context.Background(), "wrong-dim"); err == nil || errors.Is(err, ErrEmptyEmbedding) {
		t.Fatalf("expected dimension mismatch error (not ErrEmptyEmbedding), got %v", err)
	}

	// 4. Legacy gemini-embedding-001 -> :predict with parameters.outputDimensionality=768
	returnValues = vec768
	legacy001 := &VertexClient{
		ProjectID:       "games-424800",
		Location:        "us-central1",
		EmbedModel:      "gemini-embedding-001",
		AccessToken:     "secret-oauth-token",
		EndpointBaseURL: srv.URL,
		HTTPClient:      srv.Client(),
	}
	if _, err := legacy001.Embed(context.Background(), "legacy"); err != nil {
		t.Fatalf("Embed gemini-embedding-001 failed: %v", err)
	}
	if capturedPath != "/v1/projects/games-424800/locations/us-central1/publishers/google/models/gemini-embedding-001:predict" {
		t.Fatalf("unexpected legacy001 path: %q", capturedPath)
	}
	params, _ := capturedBody["parameters"].(map[string]any)
	if params == nil || params["outputDimensionality"] != float64(ExpectedEmbeddingDims) {
		t.Fatalf("expected parameters.outputDimensionality=768 for gemini-embedding-001, got %#v", capturedBody)
	}

	// 5. Upstream HTTP 503 emits BOUNDARY_FAULT without leaking token
	forceStatus = http.StatusServiceUnavailable
	_, err = client.Embed(context.Background(), "fault")
	if err == nil || strings.Contains(err.Error(), "secret-oauth-token") {
		t.Fatalf("expected clean upstream error without token leak, got %v", err)
	}

	logOut := logs.String()
	if !strings.Contains(logOut, "llm.vertex.embed_protocol_selected") || !strings.Contains(logOut, "embed_content_768") || !strings.Contains(logOut, "predict_legacy") {
		t.Fatalf("expected RULE_DIVERGENCE llm.vertex.embed_protocol_selected logs, got %s", logOut)
	}
	if !strings.Contains(logOut, "llm.vertex.embed_dim_mismatch") || !strings.Contains(logOut, "llm.vertex.upstream_http_error") {
		t.Fatalf("expected BOUNDARY_FAULT seam logs, got %s", logOut)
	}
	if strings.Contains(logOut, "secret-oauth-token") {
		t.Fatalf("bearer token leaked in logs: %s", logOut)
	}
}
