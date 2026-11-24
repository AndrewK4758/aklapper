package qdrant

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestQdrantClientSearchAndHealth(t *testing.T) {
	t.Parallel()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("api-key") != "secret-key" {
			http.Error(w, "missing api-key", http.StatusUnauthorized)
			return
		}
		switch r.URL.Path {
		case "/healthz":
			w.WriteHeader(http.StatusOK)
		case "/collections/portfolio_docs/points/search":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"result": []map[string]any{
					{
						"id":      "doc-1",
						"score":   0.92,
						"payload": map[string]any{"title": "Solar Forge"},
					},
				},
			})
		default:
			http.NotFound(w, r)
		}
	}))
	defer srv.Close()

	client := &Client{
		BaseURL:    srv.URL,
		APIKey:     "secret-key",
		HTTPClient: srv.Client(),
	}

	if err := client.Health(context.Background()); err != nil {
		t.Fatalf("Health failed: %v", err)
	}

	hits, err := client.Search(context.Background(), "portfolio_docs", []float32{0.1, 0.2}, 3)
	if err != nil {
		t.Fatalf("Search failed: %v", err)
	}
	if len(hits) != 1 || hits[0].Payload["title"] != "Solar Forge" {
		t.Fatalf("unexpected hits: %+v", hits)
	}
}

func TestQdrantUpsertPointsAndCollectionInfo(t *testing.T) {
	t.Parallel()

	var upsertedCount int
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodPut && r.URL.Path == "/collections/portfolio_docs/points":
			var body struct {
				Points []Point `json:"points"`
			}
			if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}
			upsertedCount = len(body.Points)
			_ = json.NewEncoder(w).Encode(map[string]any{"status": "ok"})
		case r.Method == http.MethodGet && r.URL.Path == "/collections/portfolio_docs":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"result": map[string]any{
					"status":       "green",
					"points_count": upsertedCount,
					"config": map[string]any{
						"params": map[string]any{
							"vectors": map[string]any{"size": 768},
						},
					},
				},
			})
		default:
			http.NotFound(w, r)
		}
	}))
	defer srv.Close()

	client := &Client{BaseURL: srv.URL, HTTPClient: srv.Client()}
	err := client.UpsertPoints(context.Background(), "portfolio_docs", []Point{
		{ID: 1, Vector: []float32{0.1, 0.2}, Payload: map[string]any{"title": "Doc 1"}},
		{ID: 2, Vector: []float32{0.3, 0.4}, Payload: map[string]any{"title": "Doc 2"}},
	})
	if err != nil {
		t.Fatalf("UpsertPoints failed: %v", err)
	}
	info, err := client.CollectionInfo(context.Background(), "portfolio_docs")
	if err != nil {
		t.Fatalf("CollectionInfo failed: %v", err)
	}
	if info.Status != "green" || info.PointsCount != 2 || info.VectorSize != 768 {
		t.Fatalf("unexpected collection info: %+v", info)
	}
}

func TestQdrantUUIDv5ListAndDeletePoints(t *testing.T) {
	t.Parallel()

	id1 := PortfolioPointID("curated:architecture", 0)
	id1Again := PortfolioPointID("curated:architecture", 0)
	idChunk1 := PortfolioPointID("curated:architecture", 1)
	if id1 != id1Again {
		t.Fatalf("expected deterministic UUIDv5, got %q != %q", id1, id1Again)
	}
	if id1 == idChunk1 {
		t.Fatalf("expected distinct chunk index UUIDv5 IDs, got identical %q", id1)
	}
	if len(id1) != 36 || id1[14] != '5' {
		t.Fatalf("expected RFC 4122 UUIDv5 version nibble '5', got %q", id1)
	}

	var deletedIDs []any
	scrollPage := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodPost && r.URL.Path == "/collections/portfolio_docs/points/scroll":
			scrollPage++
			if scrollPage == 1 {
				_ = json.NewEncoder(w).Encode(map[string]any{
					"result": map[string]any{
						"points":           []map[string]any{{"id": id1}},
						"next_page_offset": "page-2",
					},
				})
				return
			}
			_ = json.NewEncoder(w).Encode(map[string]any{
				"result": map[string]any{
					"points":           []map[string]any{{"id": "orphan-id"}},
					"next_page_offset": nil,
				},
			})
		case r.Method == http.MethodPost && r.URL.Path == "/collections/portfolio_docs/points/delete":
			var body struct {
				Points []any `json:"points"`
			}
			if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}
			deletedIDs = body.Points
			_ = json.NewEncoder(w).Encode(map[string]any{"status": "ok"})
		default:
			http.NotFound(w, r)
		}
	}))
	defer srv.Close()

	client := &Client{BaseURL: srv.URL, HTTPClient: srv.Client()}
	listed, err := client.ListPointIDs(context.Background(), "portfolio_docs")
	if err != nil {
		t.Fatalf("ListPointIDs failed: %v", err)
	}
	if len(listed) != 2 || listed[0] != id1 || listed[1] != "orphan-id" {
		t.Fatalf("unexpected listed point IDs: %+v", listed)
	}

	if err := client.DeletePoints(context.Background(), "portfolio_docs", []any{"orphan-id"}); err != nil {
		t.Fatalf("DeletePoints failed: %v", err)
	}
	if len(deletedIDs) != 1 || deletedIDs[0] != "orphan-id" {
		t.Fatalf("expected orphan-id deleted, got %+v", deletedIDs)
	}
}
