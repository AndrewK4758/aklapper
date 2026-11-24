package llm

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"
)

const (
	DefaultLocalBaseURL    = "http://127.0.0.1:11434/v1"
	DefaultLocalChatModel  = "inference"
	DefaultLocalEmbedModel = "embeddinggemma"
)

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
	BaseURL    string
	ChatModel  string
	EmbedModel string
	HTTPClient *http.Client
}

func (c *LocalClient) Name() string { return "local-llama-swap" }

func (c *LocalClient) httpClient() *http.Client {
	if c.HTTPClient != nil {
		return c.HTTPClient
	}
	return &http.Client{Timeout: 30 * time.Second}
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
	if len(parsed.Data) == 0 {
		return nil, errors.New("local llm returned zero embeddings")
	}
	return parsed.Data[0].Embedding, nil
}

// VertexStub holds the production Vertex AI / Gemini contract until GCP
// project credentials are configured.
type VertexStub struct {
	ProjectID string
	Location  string
	Model     string
}

func (v *VertexStub) Name() string { return "vertex-ai-gemini" }

func (v *VertexStub) Chat(_ context.Context, _ []ChatMessage, _ int) (Completion, error) {
	return Completion{}, fmt.Errorf("vertex ai provider requires GCP_PROJECT_ID (%q) and Vertex credentials before live inference", v.ProjectID)
}

func (v *VertexStub) Embed(_ context.Context, _ string) ([]float32, error) {
	return nil, fmt.Errorf("vertex ai embeddings require GCP_PROJECT_ID (%q) and Vertex credentials", v.ProjectID)
}

func NewFromEnv() Provider {
	if strings.EqualFold(os.Getenv("AI_PROVIDER"), "vertex") {
		model := os.Getenv("VERTEX_MODEL")
		if model == "" {
			model = "gemini-2.5-flash"
		}
		location := os.Getenv("GCP_LOCATION")
		if location == "" {
			location = "us-central1"
		}
		return &VertexStub{
			ProjectID: os.Getenv("GCP_PROJECT_ID"),
			Location:  location,
			Model:     model,
		}
	}
	baseURL := os.Getenv("LOCAL_LLM_BASE_URL")
	if baseURL == "" {
		baseURL = DefaultLocalBaseURL
	}
	return &LocalClient{
		BaseURL:    baseURL,
		ChatModel:  os.Getenv("LOCAL_LLM_CHAT_MODEL"),
		EmbedModel: os.Getenv("LOCAL_LLM_EMBED_MODEL"),
		HTTPClient: &http.Client{Timeout: 30 * time.Second},
	}
}
