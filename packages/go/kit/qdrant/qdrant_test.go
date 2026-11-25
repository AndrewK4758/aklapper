package qdrant

import (
	"context"
	"encoding/json"
	"fmt"
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

func TestQdrantListTypedPointIDsPreservesUint64ForDelete(t *testing.T) {
	t.Parallel()

	var deletedWireIDs []json.Number
	var observedSecondOffset string
	scrollCall := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodPost && r.URL.Path == "/collections/portfolio_docs/points/scroll":
			scrollCall++
			var body map[string]any
			dec := json.NewDecoder(r.Body)
			dec.UseNumber()
			_ = dec.Decode(&body)
			if scrollCall == 1 {
				_ = json.NewEncoder(w).Encode(map[string]any{
					"result": map[string]any{
						"points":           []map[string]any{{"id": 1}},
						"next_page_offset": 2,
					},
				})
				return
			}
			if off, ok := body["offset"].(json.Number); ok {
				observedSecondOffset = off.String()
			}
			_ = json.NewEncoder(w).Encode(map[string]any{
				"result": map[string]any{
					"points":           []map[string]any{{"id": 2}, {"id": "stale-uuid"}},
					"next_page_offset": nil,
				},
			})
		case r.Method == http.MethodPost && r.URL.Path == "/collections/portfolio_docs/points/delete":
			var body struct {
				Points []any `json:"points"`
			}
			dec := json.NewDecoder(r.Body)
			dec.UseNumber()
			if err := dec.Decode(&body); err != nil {
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}
			for _, raw := range body.Points {
				num, ok := raw.(json.Number)
				if !ok {
					http.Error(w, "expected numeric json point ID", http.StatusBadRequest)
					return
				}
				deletedWireIDs = append(deletedWireIDs, num)
			}
			_ = json.NewEncoder(w).Encode(map[string]any{"status": "ok"})
		default:
			http.NotFound(w, r)
		}
	}))
	defer srv.Close()

	client := &Client{BaseURL: srv.URL, HTTPClient: srv.Client()}
	typed, err := client.ListTypedPointIDs(context.Background(), "portfolio_docs")
	if err != nil {
		t.Fatalf("ListTypedPointIDs failed: %v", err)
	}
	if observedSecondOffset != "2" {
		t.Fatalf("expected numeric next_page_offset '2' forwarded without quotes, got %q", observedSecondOffset)
	}
	if len(typed) != 3 {
		t.Fatalf("expected 3 IDs, got %+v", typed)
	}
	u0, ok0 := typed[0].Raw.(uint64)
	u1, ok1 := typed[1].Raw.(uint64)
	s2, ok2 := typed[2].Raw.(string)
	if !ok0 || u0 != 1 || !ok1 || u1 != 2 || !ok2 || s2 != "stale-uuid" {
		t.Fatalf("unexpected typed point IDs: %+v", typed)
	}
	if err := client.DeletePoints(context.Background(), "portfolio_docs", []any{typed[0].Raw, typed[1].Raw}); err != nil {
		t.Fatalf("DeletePoints failed for uint64 IDs: %v", err)
	}
	if len(deletedWireIDs) != 2 || deletedWireIDs[0].String() != "1" || deletedWireIDs[1].String() != "2" {
		t.Fatalf("expected JSON numbers [1, 2], got %+v", deletedWireIDs)
	}
}

func TestQdrantListTypedPointIDsStopsOnRepeatingOffset(t *testing.T) {
	t.Parallel()

	scrollCalls := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.URL.Path != "/collections/portfolio_docs/points/scroll" {
			http.NotFound(w, r)
			return
		}
		scrollCalls++
		_ = json.NewEncoder(w).Encode(map[string]any{
			"result": map[string]any{
				"points":           []map[string]any{{"id": fmt.Sprintf("pt-%d", scrollCalls)}},
				"next_page_offset": "stuck-cursor",
			},
		})
	}))
	defer srv.Close()

	client := &Client{BaseURL: srv.URL, HTTPClient: srv.Client()}
	typed, err := client.ListTypedPointIDs(context.Background(), "portfolio_docs")
	if err != nil {
		t.Fatalf("ListTypedPointIDs failed on repeating offset: %v", err)
	}
	if scrollCalls != 2 {
		t.Fatalf("expected cycle guard to stop after 2 pages on repeating offset, got %d calls", scrollCalls)
	}
	if len(typed) != 2 {
		t.Fatalf("expected 2 collected IDs before cycle break, got %+v", typed)
	}
}
