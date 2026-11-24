package qdrant

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"
)

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
