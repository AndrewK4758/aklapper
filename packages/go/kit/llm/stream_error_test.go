package llm

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestChatStreamFailsOnMidStreamSSEErrorFrames(t *testing.T) {
	t.Run("Vertex AI mid-stream error JSON frame returns error instead of silent success", func(t *testing.T) {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "text/event-stream")
			flusher := w.(http.Flusher)
			_, _ = w.Write([]byte("data: {\"candidates\":[{\"content\":{\"parts\":[{\"text\":\"Partial \"}]}}]}\n\n"))
			flusher.Flush()
			_, _ = w.Write([]byte("data: {\"error\":{\"code\":500,\"message\":\"Internal error encountered.\",\"status\":\"INTERNAL\"}}\n\n"))
			flusher.Flush()
		}))
		defer srv.Close()

		client := &VertexClient{
			ProjectID:       "demo-proj",
			Location:        "us-central1",
			Model:           "gemini-2.5-flash",
			EndpointBaseURL: srv.URL,
			AccessToken:     "fake-token",
		}
		res, err := client.ChatStream(context.Background(), ChatStreamRequest{
			Messages:    []ChatMessage{{Role: "user", Content: "Hi"}},
			IdleTimeout: 5 * time.Second,
		}, nil)
		if err == nil {
			t.Fatalf("expected mid-stream Vertex error to fail, got nil (res=%+v)", res)
		}
		if !strings.Contains(err.Error(), "Internal error encountered") {
			t.Fatalf("expected upstream error message in err, got %v", err)
		}
	})

	t.Run("Local OpenAI event:error and inline error frames return error", func(t *testing.T) {
		cases := []struct {
			name string
			body string
		}{
			{
				name: "SSE event: error frame",
				body: "event: error\ndata: {\"error\":{\"message\":\"context window exceeded\",\"type\":\"server_error\",\"code\":500}}\n\n",
			},
			{
				name: "inline JSON error frame without event line",
				body: "data: {\"error\":{\"message\":\"upstream overloaded\",\"type\":\"server_error\"}}\n\n",
			},
		}
		for _, tc := range cases {
			t.Run(tc.name, func(t *testing.T) {
				srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					w.Header().Set("Content-Type", "text/event-stream")
					_, _ = w.Write([]byte(tc.body))
				}))
				defer srv.Close()

				client := &LocalClient{BaseURL: srv.URL, ChatModel: "inference"}
				res, err := client.ChatStream(context.Background(), ChatStreamRequest{
					Messages:    []ChatMessage{{Role: "user", Content: "Hi"}},
					IdleTimeout: 5 * time.Second,
				}, nil)
				if err == nil {
					t.Fatalf("expected mid-stream local error to fail, got nil (res=%+v)", res)
				}
			})
		}
	})
}
