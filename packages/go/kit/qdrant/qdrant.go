package qdrant

import (
	"bytes"
	"context"
	"crypto/sha1"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"
)

// PortfolioNamespace is a stable RFC 4122 UUIDv5 namespace shared across corpus indexers.
var PortfolioNamespace = [16]byte{
	0x6b, 0xa7, 0xb8, 0x11,
	0x9d, 0xad,
	0x11, 0xd1,
	0x80, 0xb4,
	0x00, 0xc0, 0x4f, 0xd4, 0x30, 0xc8,
}

// DeterministicPointID computes an RFC 4122 UUIDv5 string from namespace and canonicalKey.
func DeterministicPointID(namespace [16]byte, canonicalKey string) string {
	buf := make([]byte, 0, len(namespace)+len(canonicalKey))
	buf = append(buf, namespace[:]...)
	buf = append(buf, canonicalKey...)
	sum := sha1.Sum(buf)
	sum[6] = (sum[6] & 0x0f) | 0x50
	sum[8] = (sum[8] & 0x3f) | 0x80
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x", sum[0:4], sum[4:6], sum[6:8], sum[8:10], sum[10:16])
}

// PortfolioPointID builds a canonical UUIDv5 point identifier from docKey and chunkIndex.
func PortfolioPointID(docKey string, chunkIndex int) string {
	return DeterministicPointID(PortfolioNamespace, strings.TrimSpace(docKey)+"#"+strconv.Itoa(chunkIndex))
}

const DefaultURL = "http://127.0.0.1:6333"

type Client struct {
	BaseURL    string
	APIKey     string
	HTTPClient *http.Client
}

type SearchHit struct {
	ID      any            `json:"id"`
	Score   float64        `json:"score"`
	Payload map[string]any `json:"payload"`
}

type searchResponse struct {
	Result []SearchHit `json:"result"`
}

func NewFromEnv() *Client {
	baseURL := strings.TrimRight(os.Getenv("QDRANT_URL"), "/")
	if baseURL == "" {
		baseURL = DefaultURL
	}
	return &Client{
		BaseURL: baseURL,
		APIKey:  os.Getenv("QDRANT_API_KEY"),
		HTTPClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

func (c *Client) httpClient() *http.Client {
	if c.HTTPClient != nil {
		return c.HTTPClient
	}
	return &http.Client{Timeout: 10 * time.Second}
}

func (c *Client) newRequest(ctx context.Context, method, path string, body any) (*http.Request, error) {
	var buf bytes.Buffer
	if body != nil {
		if err := json.NewEncoder(&buf).Encode(body); err != nil {
			return nil, err
		}
	}
	req, err := http.NewRequestWithContext(ctx, method, strings.TrimRight(c.BaseURL, "/")+path, &buf)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	if c.APIKey != "" {
		req.Header.Set("api-key", c.APIKey)
	}
	return req, nil
}

func (c *Client) Health(ctx context.Context) error {
	req, err := c.newRequest(ctx, http.MethodGet, "/healthz", nil)
	if err != nil {
		return err
	}
	res, err := c.httpClient().Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode >= 300 {
		return fmt.Errorf("qdrant health failed with status %d", res.StatusCode)
	}
	return nil
}

func (c *Client) EnsureCollection(ctx context.Context, name string, vectorSize int) error {
	payload := map[string]any{
		"vectors": map[string]any{
			"size":     vectorSize,
			"distance": "Cosine",
		},
	}
	req, err := c.newRequest(ctx, http.MethodPut, "/collections/"+name, payload)
	if err != nil {
		return err
	}
	res, err := c.httpClient().Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode >= 300 && res.StatusCode != http.StatusConflict {
		return fmt.Errorf("qdrant ensure collection %q failed with status %d", name, res.StatusCode)
	}
	return nil
}

type Point struct {
	ID      any            `json:"id"`
	Vector  []float32      `json:"vector"`
	Payload map[string]any `json:"payload"`
}

type CollectionInfo struct {
	Status      string `json:"status"`
	PointsCount int    `json:"pointsCount"`
	VectorSize  int    `json:"vectorSize"`
}

func (c *Client) Search(ctx context.Context, collection string, vector []float32, limit int) ([]SearchHit, error) {
	if limit <= 0 {
		limit = 5
	}
	payload := map[string]any{
		"vector":       vector,
		"limit":        limit,
		"with_payload": true,
	}
	req, err := c.newRequest(ctx, http.MethodPost, "/collections/"+collection+"/points/search", payload)
	if err != nil {
		return nil, err
	}
	res, err := c.httpClient().Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	if res.StatusCode >= 300 {
		return nil, fmt.Errorf("qdrant search failed with status %d", res.StatusCode)
	}
	var parsed searchResponse
	if err := json.NewDecoder(res.Body).Decode(&parsed); err != nil {
		return nil, err
	}
	return parsed.Result, nil
}

func (c *Client) UpsertPoints(ctx context.Context, collection string, points []Point) error {
	if len(points) == 0 {
		return nil
	}
	payload := map[string]any{
		"points": points,
	}
	req, err := c.newRequest(ctx, http.MethodPut, "/collections/"+collection+"/points?wait=true", payload)
	if err != nil {
		return err
	}
	res, err := c.httpClient().Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode >= 300 {
		return fmt.Errorf("qdrant upsert points to %q failed with status %d", collection, res.StatusCode)
	}
	return nil
}

func (c *Client) CollectionInfo(ctx context.Context, collection string) (*CollectionInfo, error) {
	req, err := c.newRequest(ctx, http.MethodGet, "/collections/"+collection, nil)
	if err != nil {
		return nil, err
	}
	res, err := c.httpClient().Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	if res.StatusCode >= 300 {
		return nil, fmt.Errorf("qdrant collection info %q failed with status %d", collection, res.StatusCode)
	}
	var parsed struct {
		Result struct {
			Status      string `json:"status"`
			PointsCount int    `json:"points_count"`
			Config      struct {
				Params struct {
					Vectors struct {
						Size int `json:"size"`
					} `json:"vectors"`
				} `json:"params"`
			} `json:"config"`
		} `json:"result"`
	}
	if err := json.NewDecoder(res.Body).Decode(&parsed); err != nil {
		return nil, err
	}
	return &CollectionInfo{
		Status:      parsed.Result.Status,
		PointsCount: parsed.Result.PointsCount,
		VectorSize:  parsed.Result.Config.Params.Vectors.Size,
	}, nil
}

// StoredPointID preserves a scrolled Qdrant point identifier's lookup key and wire representation.
type StoredPointID struct {
	Key string
	Raw any
}

func parseStoredPointID(raw any) (StoredPointID, bool) {
	switch v := raw.(type) {
	case string:
		trimmed := strings.TrimSpace(v)
		if trimmed == "" {
			return StoredPointID{}, false
		}
		return StoredPointID{Key: trimmed, Raw: trimmed}, true
	case json.Number:
		s := strings.TrimSpace(v.String())
		if s == "" {
			return StoredPointID{}, false
		}
		if u, err := strconv.ParseUint(s, 10, 64); err == nil {
			return StoredPointID{Key: strconv.FormatUint(u, 10), Raw: u}, true
		}
		if i, err := v.Int64(); err == nil && i >= 0 {
			u := uint64(i)
			return StoredPointID{Key: strconv.FormatUint(u, 10), Raw: u}, true
		}
		return StoredPointID{}, false
	case float64:
		if v >= 0 {
			u := uint64(v)
			return StoredPointID{Key: strconv.FormatUint(u, 10), Raw: u}, true
		}
		return StoredPointID{}, false
	default:
		return StoredPointID{}, false
	}
}

// ListTypedPointIDs scrolls all stored point IDs while preserving string vs uint64 wire types.
func (c *Client) ListTypedPointIDs(ctx context.Context, collection string) ([]StoredPointID, error) {
	const maxScrollPages = 1000
	ids := []StoredPointID{}
	var offset any
	seenOffsets := make(map[string]struct{})

	for range maxScrollPages {
		body := map[string]any{
			"limit":        256,
			"with_payload": false,
			"with_vector":  false,
		}
		if offset != nil {
			body["offset"] = offset
		}
		req, err := c.newRequest(ctx, http.MethodPost, "/collections/"+collection+"/points/scroll", body)
		if err != nil {
			return nil, err
		}
		res, err := c.httpClient().Do(req)
		if err != nil {
			return nil, err
		}
		if res.StatusCode == http.StatusNotFound {
			res.Body.Close()
			return []StoredPointID{}, nil
		}
		if res.StatusCode >= 300 {
			res.Body.Close()
			return nil, fmt.Errorf("qdrant scroll %q failed with status %d", collection, res.StatusCode)
		}

		var parsed struct {
			Result struct {
				Points []struct {
					ID any `json:"id"`
				} `json:"points"`
				NextPageOffset any `json:"next_page_offset"`
			} `json:"result"`
		}
		dec := json.NewDecoder(res.Body)
		dec.UseNumber()
		decodeErr := dec.Decode(&parsed)
		res.Body.Close()
		if decodeErr != nil {
			return nil, decodeErr
		}
		for _, pt := range parsed.Result.Points {
			if id, ok := parseStoredPointID(pt.ID); ok {
				ids = append(ids, id)
			}
		}
		if parsed.Result.NextPageOffset == nil {
			break
		}
		offsetKey := fmt.Sprint(parsed.Result.NextPageOffset)
		if _, seen := seenOffsets[offsetKey]; seen {
			break
		}
		seenOffsets[offsetKey] = struct{}{}
		offset = parsed.Result.NextPageOffset
	}
	return ids, nil
}

// ListPointIDs scrolls all stored point IDs as strings for callers needing canonical string keys.
func (c *Client) ListPointIDs(ctx context.Context, collection string) ([]string, error) {
	typed, err := c.ListTypedPointIDs(ctx, collection)
	if err != nil {
		return nil, err
	}
	ids := make([]string, len(typed))
	for i, pt := range typed {
		ids[i] = pt.Key
	}
	return ids, nil
}

// DeletePoints deletes the specified point IDs synchronously from a Qdrant collection.
func (c *Client) DeletePoints(ctx context.Context, collection string, ids []any) error {
	if len(ids) == 0 {
		return nil
	}
	payload := map[string]any{
		"points": ids,
	}
	req, err := c.newRequest(ctx, http.MethodPost, "/collections/"+collection+"/points/delete?wait=true", payload)
	if err != nil {
		return err
	}
	res, err := c.httpClient().Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode >= 300 {
		return fmt.Errorf("qdrant delete points from %q failed with status %d", collection, res.StatusCode)
	}
	return nil
}
