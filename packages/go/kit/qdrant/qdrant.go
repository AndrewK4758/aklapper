package qdrant

import (
	"bytes"
	"context"
	"crypto/sha1"
	"encoding/json"
	"errors"
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

// CollectionChunkPointID derives the canonical RFC 4122 UUIDv5 point identifier for a
// collection, docKey, and chunkIndex. For portfolio_docs it delegates directly to
// PortfolioPointID(docKey, chunkIndex) so CLI seeding and HTTP reindex produce identical IDs.
func CollectionChunkPointID(collection, docKey string, chunkIndex int) string {
	trimmedCol := strings.TrimSpace(collection)
	trimmedDoc := strings.TrimSpace(docKey)
	if chunkIndex < 0 {
		chunkIndex = 0
	}
	if trimmedCol == "" || trimmedCol == "portfolio_docs" {
		return PortfolioPointID(trimmedDoc, chunkIndex)
	}
	return DeterministicPointID(PortfolioNamespace, trimmedCol+":"+trimmedDoc+"#"+strconv.Itoa(chunkIndex))
}

// CollectionPointID derives the canonical RFC 4122 UUIDv5 point identifier for chunk 0.
func CollectionPointID(collection, docKey string) string {
	return CollectionChunkPointID(collection, docKey, 0)
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

type Point struct {
	ID      any            `json:"id"`
	Vector  []float32      `json:"vector"`
	Payload map[string]any `json:"payload"`
}

type CollectionInfo struct {
	Status      string `json:"status"`
	PointsCount int    `json:"pointsCount"`
	VectorSize  int    `json:"vectorSize"`
	Distance    string `json:"distance,omitempty"`
}

func NewFromEnv() *Client {
	baseURL := strings.TrimRight(os.Getenv("QDRANT_URL"), "/")
	if baseURL == "" {
		baseURL = DefaultURL
	}
	return &Client{
		BaseURL:    baseURL,
		APIKey:     os.Getenv("QDRANT_API_KEY"),
		HTTPClient: &http.Client{Timeout: 10 * time.Second},
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

func isValidRFC4122UUID(value string) bool {
	if len(value) != 36 {
		return false
	}
	for i := 0; i < len(value); i++ {
		c := value[i]
		if i == 8 || i == 13 || i == 18 || i == 23 {
			if c != '-' {
				return false
			}
			continue
		}
		if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F')) {
			return false
		}
	}
	if value[14] < '1' || value[14] > '8' {
		return false
	}
	return value[19] == '8' || value[19] == '9' || value[19] == 'a' || value[19] == 'b' || value[19] == 'A' || value[19] == 'B'
}

// IsValidPointID validates Qdrant point IDs (uint64, non-negative integers, or RFC-4122 UUIDs).
func IsValidPointID(id any) bool {
	switch v := id.(type) {
	case uint64, uint, uint32, uint16, uint8:
		return true
	case int:
		return v >= 0
	case int64:
		return v >= 0
	case int32:
		return v >= 0
	case int16:
		return v >= 0
	case int8:
		return v >= 0
	case json.Number:
		_, err := strconv.ParseUint(v.String(), 10, 64)
		return err == nil
	case string:
		return isValidRFC4122UUID(v)
	default:
		return false
	}
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
	if strings.TrimSpace(name) == "" {
		return errors.New("qdrant collection name is required")
	}
	if vectorSize <= 0 {
		return fmt.Errorf("qdrant collection %q vectorSize must be positive (got %d)", name, vectorSize)
	}
	payload := map[string]any{"vectors": map[string]any{"size": vectorSize, "distance": "Cosine"}}
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
	info, infoErr := c.CollectionInfo(ctx, name)
	if infoErr != nil {
		return fmt.Errorf("qdrant verify collection %q info failed after status %d: %w", name, res.StatusCode, infoErr)
	}
	if info.VectorSize != vectorSize {
		return fmt.Errorf("qdrant collection %q vector dimension mismatch: expected %d, got %d", name, vectorSize, info.VectorSize)
	}
	if info.Distance != "" && !strings.EqualFold(info.Distance, "Cosine") {
		return fmt.Errorf("qdrant collection %q distance metric mismatch: expected Cosine, got %q", name, info.Distance)
	}
	return nil
}

func (c *Client) Search(ctx context.Context, collection string, vector []float32, limit int) ([]SearchHit, error) {
	if limit <= 0 {
		limit = 5
	}
	payload := map[string]any{"vector": vector, "limit": limit, "with_payload": true}
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
	var parsed struct {
		Result []SearchHit `json:"result"`
	}
	if err := json.NewDecoder(res.Body).Decode(&parsed); err != nil {
		return nil, err
	}
	return parsed.Result, nil
}

func (c *Client) UpsertPoints(ctx context.Context, collection string, points []Point) error {
	if len(points) == 0 {
		return nil
	}
	expectedSize := len(points[0].Vector)
	if expectedSize == 0 {
		return fmt.Errorf("qdrant upsert %q rejected empty vector at point 0", collection)
	}
	for i, pt := range points {
		if !IsValidPointID(pt.ID) {
			return fmt.Errorf("qdrant upsert %q rejected invalid point id at index %d: %v", collection, i, pt.ID)
		}
		if len(pt.Vector) == 0 || len(pt.Vector) != expectedSize {
			return fmt.Errorf("qdrant upsert %q vector dimension mismatch at index %d: expected %d, got %d", collection, i, expectedSize, len(pt.Vector))
		}
	}
	req, err := c.newRequest(ctx, http.MethodPut, "/collections/"+collection+"/points?wait=true", map[string]any{"points": points})
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
						Size     int    `json:"size"`
						Distance string `json:"distance"`
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
		Distance:    parsed.Result.Config.Params.Vectors.Distance,
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
			return nil, fmt.Errorf("qdrant scroll %q decode failed: %w", collection, decodeErr)
		}
		for _, pt := range parsed.Result.Points {
			if id, ok := parseStoredPointID(pt.ID); ok {
				ids = append(ids, id)
			}
		}
		nextOffset := parsed.Result.NextPageOffset
		if nextOffset == nil || len(parsed.Result.Points) == 0 {
			break
		}
		if strOffset, ok := nextOffset.(string); ok && strings.TrimSpace(strOffset) == "" {
			break
		}
		offsetKey := fmt.Sprintf("%T:%v", nextOffset, nextOffset)
		if _, seen := seenOffsets[offsetKey]; seen {
			break
		}
		seenOffsets[offsetKey] = struct{}{}
		offset = nextOffset
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

// ScrollPointIDs scrolls all stored point IDs preserving uint64 vs UUID string wire types.
func (c *Client) ScrollPointIDs(ctx context.Context, collection string) ([]any, error) {
	typed, err := c.ListTypedPointIDs(ctx, collection)
	if err != nil {
		return nil, err
	}
	ids := make([]any, len(typed))
	for i, pt := range typed {
		ids[i] = pt.Raw
	}
	return ids, nil
}

// DeletePoints deletes the specified point IDs synchronously from a Qdrant collection.
func (c *Client) DeletePoints(ctx context.Context, collection string, ids []any) error {
	if len(ids) == 0 {
		return nil
	}
	for i, id := range ids {
		if !IsValidPointID(id) {
			return fmt.Errorf("qdrant delete %q rejected invalid point id at index %d: %v", collection, i, id)
		}
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
