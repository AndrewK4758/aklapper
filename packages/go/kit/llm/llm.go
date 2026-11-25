package llm

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
)

const (
	DefaultLocalBaseURL    = "http://127.0.0.1:11434/v1"
	DefaultLocalChatModel  = "inference"
	DefaultLocalEmbedModel = "embedding"
	ExpectedEmbeddingDims  = 768
)

// ErrEmptyEmbedding indicates an embedding backend succeeded over HTTP but returned zero dimensions.
var ErrEmptyEmbedding = errors.New("empty embedding vector")

// ValidateEmbeddingDims verifies embedding vectors match the configured 768-dim Qdrant index
// and contain finite float values before any vector store I/O occurs.
func ValidateEmbeddingDims(vec []float32) error {
	if len(vec) != ExpectedEmbeddingDims {
		return fmt.Errorf("expected %d embedding dimensions, got %d", ExpectedEmbeddingDims, len(vec))
	}
	for i, v := range vec {
		if math.IsNaN(float64(v)) || math.IsInf(float64(v), 0) {
			return fmt.Errorf("non-finite embedding value at index %d", i)
		}
	}
	return nil
}

type ChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type Completion struct {
	Text       string
	TokensUsed int
	Model      string
}

type Provider interface {
	Name() string
	Chat(ctx context.Context, messages []ChatMessage, maxTokens int) (Completion, error)
	Embed(ctx context.Context, text string) ([]float32, error)
}

type LocalClient struct {
	BaseURL             string
	ChatModel           string
	EmbedModel          string
	HTTPClient          *http.Client
	StreamHTTPClient    *http.Client
	streamClientOnce    sync.Once
	defaultStreamClient *http.Client
}

func (c *LocalClient) Name() string { return "local-llama-swap" }

func (c *LocalClient) httpClient() *http.Client {
	if c.HTTPClient != nil {
		return c.HTTPClient
	}
	return &http.Client{Timeout: localHTTPTimeout()}
}

func (c *LocalClient) Chat(ctx context.Context, messages []ChatMessage, maxTokens int) (Completion, error) {
	if maxTokens <= 0 {
		maxTokens = 512
	}
	model := c.ChatModel
	if model == "" {
		model = DefaultLocalChatModel
	}
	body, err := json.Marshal(map[string]any{
		"model":       model,
		"messages":    messages,
		"max_tokens":  maxTokens,
		"temperature": 0.2,
	})
	if err != nil {
		return Completion{}, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, strings.TrimRight(c.BaseURL, "/")+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return Completion{}, err
	}
	req.Header.Set("Content-Type", "application/json")
	res, err := c.httpClient().Do(req)
	if err != nil {
		return Completion{}, err
	}
	defer res.Body.Close()
	if res.StatusCode >= 300 {
		return Completion{}, fmt.Errorf("local llm chat failed with status %d", res.StatusCode)
	}
	var parsed struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
		Usage struct {
			TotalTokens int `json:"total_tokens"`
		} `json:"usage"`
	}
	if err := json.NewDecoder(res.Body).Decode(&parsed); err != nil {
		return Completion{}, err
	}
	if len(parsed.Choices) == 0 {
		return Completion{}, errors.New("local llm returned zero choices")
	}
	return Completion{
		Text:       parsed.Choices[0].Message.Content,
		TokensUsed: parsed.Usage.TotalTokens,
		Model:      model,
	}, nil
}

func (c *LocalClient) Embed(ctx context.Context, text string) ([]float32, error) {
	model := c.EmbedModel
	if model == "" {
		model = DefaultLocalEmbedModel
	}
	body, err := json.Marshal(map[string]any{
		"model": model,
		"input": text,
	})
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, strings.TrimRight(c.BaseURL, "/")+"/embeddings", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	res, err := c.httpClient().Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	if res.StatusCode >= 300 {
		return nil, fmt.Errorf("local llm embed failed with status %d", res.StatusCode)
	}
	var parsed struct {
		Data []struct {
			Embedding []float32 `json:"embedding"`
		} `json:"data"`
	}
	if err := json.NewDecoder(res.Body).Decode(&parsed); err != nil {
		return nil, err
	}
	if len(parsed.Data) == 0 || len(parsed.Data[0].Embedding) == 0 {
		return nil, fmt.Errorf("%w: local llm returned zero embeddings", ErrEmptyEmbedding)
	}
	return parsed.Data[0].Embedding, nil
}

// VertexClient calls Vertex AI Gemini (:generateContent / :streamGenerateContent) and
// Embeddings (:embedContent / :predict) using GOOGLE_OAUTH_ACCESS_TOKEN or GCP Metadata Server.
type VertexClient struct {
	ProjectID           string
	Location            string
	Model               string
	EmbedModel          string
	ThinkingLevel       string
	AccessToken         string
	MetadataURL         string
	EndpointBaseURL     string
	ThinkingBudget      *int
	HTTPClient          *http.Client
	StreamHTTPClient    *http.Client
	streamClientOnce    sync.Once
	defaultStreamClient *http.Client
}

// VertexStub is kept as a type alias for backward compatibility.
type VertexStub = VertexClient

func (v *VertexClient) Name() string { return "vertex-ai-gemini" }

func (v *VertexClient) httpClient() *http.Client {
	if v.HTTPClient != nil {
		return v.HTTPClient
	}
	return &http.Client{Timeout: 30 * time.Second}
}

func (v *VertexClient) endpointBase() string {
	return formatVertexEndpointBase(v.Location, v.EndpointBaseURL)
}

func (v *VertexClient) resolveAccessToken(ctx context.Context) (string, error) {
	if tok := strings.TrimSpace(v.AccessToken); tok != "" {
		return tok, nil
	}
	if tok := strings.TrimSpace(os.Getenv("GOOGLE_OAUTH_ACCESS_TOKEN")); tok != "" {
		return tok, nil
	}
	metaURL := strings.TrimSpace(v.MetadataURL)
	if metaURL == "" {
		metaURL = strings.TrimSpace(os.Getenv("GCP_METADATA_TOKEN_URL"))
	}
	if metaURL == "" {
		metaURL = DefaultGCPMetadataURL
	}

	metaCtx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(metaCtx, http.MethodGet, metaURL, nil)
	if err != nil {
		return "", fmt.Errorf("vertex ai metadata request failed for %q: %w", v.ProjectID, err)
	}
	req.Header.Set("Metadata-Flavor", "Google")

	res, err := v.httpClient().Do(req)
	if err != nil {
		return "", fmt.Errorf("vertex ai credentials unavailable for %q/%q (metadata server unreachable): %w", v.ProjectID, v.Location, err)
	}
	defer res.Body.Close()
	if res.StatusCode >= 300 {
		return "", fmt.Errorf("vertex ai metadata server returned status %d for %q/%q", res.StatusCode, v.ProjectID, v.Location)
	}

	var parsed struct {
		AccessToken string `json:"access_token"`
	}
	if err := json.NewDecoder(res.Body).Decode(&parsed); err != nil {
		return "", fmt.Errorf("vertex ai metadata decode failed: %w", err)
	}
	if strings.TrimSpace(parsed.AccessToken) == "" {
		return "", errors.New("vertex ai metadata server returned empty access_token")
	}
	return parsed.AccessToken, nil
}

func (v *VertexClient) Chat(ctx context.Context, messages []ChatMessage, maxTokens int) (Completion, error) {
	if strings.TrimSpace(v.ProjectID) == "" {
		return Completion{}, errors.New("vertex ai provider requires GCP_PROJECT_ID")
	}
	if maxTokens <= 0 {
		maxTokens = 512
	}
	model := strings.TrimSpace(v.Model)
	if model == "" {
		model = DefaultVertexModel
	}
	loc := normalizeVertexLocation(v.Location)

	payload, err := buildVertexGeneratePayload(model, messages, maxTokens, nil, v.ThinkingLevel, v.ThinkingBudget, false, nil)
	if err != nil {
		return Completion{}, err
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return Completion{}, err
	}
	token, err := v.resolveAccessToken(ctx)
	if err != nil {
		return Completion{}, err
	}
	endpoint := fmt.Sprintf(
		"%s/v1/projects/%s/locations/%s/publishers/google/models/%s:generateContent",
		v.endpointBase(),
		v.ProjectID,
		loc,
		model,
	)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return Completion{}, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)

	res, err := v.httpClient().Do(req)
	if err != nil {
		return Completion{}, err
	}
	defer res.Body.Close()
	if res.StatusCode >= 300 {
		logLLMSeam("BOUNDARY_FAULT", "llm.vertex.upstream_http_error", map[string]any{
			"action":   "generateContent",
			"status":   res.StatusCode,
			"model":    model,
			"location": loc,
		})
		return Completion{}, fmt.Errorf("vertex ai generateContent failed with status %d", res.StatusCode)
	}

	var parsed struct {
		Candidates []struct {
			Content struct {
				Parts []vertexPart `json:"parts"`
			} `json:"content"`
		} `json:"candidates"`
		UsageMetadata struct {
			PromptTokenCount     int `json:"promptTokenCount"`
			CandidatesTokenCount int `json:"candidatesTokenCount"`
			TotalTokenCount      int `json:"totalTokenCount"`
		} `json:"usageMetadata"`
	}
	if err := json.NewDecoder(res.Body).Decode(&parsed); err != nil {
		return Completion{}, err
	}
	if len(parsed.Candidates) == 0 {
		return Completion{}, errors.New("vertex ai returned zero candidates")
	}

	text := extractVertexNonThoughtText(parsed.Candidates[0].Content.Parts)
	tokens := parsed.UsageMetadata.TotalTokenCount
	if tokens == 0 {
		tokens = parsed.UsageMetadata.PromptTokenCount + parsed.UsageMetadata.CandidatesTokenCount
	}
	return Completion{
		Text:       strings.TrimSpace(text),
		TokensUsed: tokens,
		Model:      model,
	}, nil
}

func (v *VertexClient) Embed(ctx context.Context, text string) ([]float32, error) {
	if strings.TrimSpace(v.ProjectID) == "" {
		return nil, errors.New("vertex ai embeddings require GCP_PROJECT_ID")
	}
	token, err := v.resolveAccessToken(ctx)
	if err != nil {
		return nil, err
	}
	model := strings.TrimSpace(v.EmbedModel)
	if model == "" {
		model = DefaultVertexEmbedModel
	}
	loc := strings.TrimSpace(v.Location)
	if loc == "" {
		loc = DefaultVertexLocation
	}

	body, err := json.Marshal(map[string]any{
		"instances": []map[string]string{
			{"content": text},
		},
	})
	if err != nil {
		return nil, err
	}
	endpoint := fmt.Sprintf(
		"%s/v1/projects/%s/locations/%s/publishers/google/models/%s:predict",
		v.endpointBase(),
		v.ProjectID,
		loc,
		model,
	)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)

	res, err := v.httpClient().Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	if res.StatusCode >= 300 {
		return nil, fmt.Errorf("vertex ai predict failed with status %d", res.StatusCode)
	}

	var parsed struct {
		Predictions []struct {
			Embeddings struct {
				Values []float32 `json:"values"`
			} `json:"embeddings"`
		} `json:"predictions"`
	}
	if err := json.NewDecoder(res.Body).Decode(&parsed); err != nil {
		return nil, err
	}
	if len(parsed.Predictions) == 0 || len(parsed.Predictions[0].Embeddings.Values) == 0 {
		return nil, fmt.Errorf("%w: vertex ai returned zero embeddings", ErrEmptyEmbedding)
	}
	return parsed.Predictions[0].Embeddings.Values, nil
}

func NewFromEnv() Provider {
	return NewFromEnvMap(os.Getenv)
}
