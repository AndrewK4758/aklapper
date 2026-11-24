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
}
