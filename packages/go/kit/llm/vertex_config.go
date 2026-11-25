package llm

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const (
	DefaultVertexModel         = "gemini-3.8-flash"
	DefaultVertexEmbedModel    = "gemini-embedding-2"
	DefaultVertexLocation      = "global"
	DefaultVertexThinkingLevel = "LOW"
	DefaultGCPMetadataURL      = "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token"
)

func normalizeVertexLocation(location string) string {
	trimmed := strings.TrimSpace(location)
	if trimmed == "" || strings.EqualFold(trimmed, "global") {
		return DefaultVertexLocation
	}
	return trimmed
}

func formatVertexEndpointBase(location, endpointBaseURL string) string {
	if base := strings.TrimRight(strings.TrimSpace(endpointBaseURL), "/"); base != "" {
		return base
	}
	loc := normalizeVertexLocation(location)
	if loc == DefaultVertexLocation {
		return "https://aiplatform.googleapis.com"
	}
	return fmt.Sprintf("https://%s-aiplatform.googleapis.com", loc)
}

// ParseVertexThinkingLevel validates VERTEX_THINKING_LEVEL, defaulting empty values to "LOW",
// normalizing valid values ("LOW", "MEDIUM", "HIGH") to uppercase, and failing closed otherwise.
func ParseVertexThinkingLevel(raw string) (string, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return DefaultVertexThinkingLevel, nil
	}
	upper := strings.ToUpper(trimmed)
	switch upper {
	case "LOW", "MEDIUM", "HIGH":
		return upper, nil
	default:
		logLLMSeam("UNSOUND_CONDITION", "llm.vertex.invalid_thinking_level", map[string]any{
			"value": trimmed,
		})
		return "", fmt.Errorf("invalid VERTEX_THINKING_LEVEL %q: must be LOW, MEDIUM, or HIGH", raw)
	}
}

func isGemini3Model(model string) bool {
	return strings.HasPrefix(strings.ToLower(strings.TrimSpace(model)), "gemini-3")
}

func usesEmbedContent(model string) bool {
	return strings.HasPrefix(strings.ToLower(strings.TrimSpace(model)), "gemini-embedding-2")
}

func isGeminiEmbedding001(model string) bool {
	return strings.HasPrefix(strings.ToLower(strings.TrimSpace(model)), "gemini-embedding-001")
}

func buildVertexEmbedPayload(model, text string) (action string, branch string, payload map[string]any) {
	if usesEmbedContent(model) {
		return "embedContent", "embed_content_768", map[string]any{
			"content": map[string]any{
				"parts": []map[string]string{{"text": text}},
			},
			"outputDimensionality": ExpectedEmbeddingDims,
		}
	}
	p := map[string]any{
		"instances": []map[string]string{
			{"content": text},
		},
	}
	if isGeminiEmbedding001(model) {
		p["parameters"] = map[string]any{
			"outputDimensionality": ExpectedEmbeddingDims,
		}
	}
	return "predict", "predict_legacy", p
}

func decodeVertexEmbedResponse(action, model, loc string, r io.Reader) ([]float32, error) {
	if action == "embedContent" {
		var parsed struct {
			Embedding struct {
				Values []float32 `json:"values"`
			} `json:"embedding"`
		}
		if err := json.NewDecoder(r).Decode(&parsed); err != nil {
			return nil, err
		}
		values := parsed.Embedding.Values
		if len(values) == 0 {
			logLLMSeam("BOUNDARY_FAULT", "llm.vertex.embed_dim_mismatch", map[string]any{
				"action":   action,
				"model":    model,
				"location": loc,
				"dims":     0,
			})
			return nil, fmt.Errorf("%w: vertex ai embedContent returned zero embeddings", ErrEmptyEmbedding)
		}
		if err := ValidateEmbeddingDims(values); err != nil {
			logLLMSeam("BOUNDARY_FAULT", "llm.vertex.embed_dim_mismatch", map[string]any{
				"action":   action,
				"model":    model,
				"location": loc,
				"dims":     len(values),
			})
			return nil, fmt.Errorf("vertex ai embedContent dimension error: %w", err)
		}
		return values, nil
	}

	var parsed struct {
		Predictions []struct {
			Embeddings struct {
				Values []float32 `json:"values"`
			} `json:"embeddings"`
		} `json:"predictions"`
	}
	if err := json.NewDecoder(r).Decode(&parsed); err != nil {
		return nil, err
	}
	if len(parsed.Predictions) == 0 || len(parsed.Predictions[0].Embeddings.Values) == 0 {
		logLLMSeam("BOUNDARY_FAULT", "llm.vertex.embed_dim_mismatch", map[string]any{
			"action":   action,
			"model":    model,
			"location": loc,
			"dims":     0,
		})
		return nil, fmt.Errorf("%w: vertex ai returned zero embeddings", ErrEmptyEmbedding)
	}
	return parsed.Predictions[0].Embeddings.Values, nil
}

// NewFromEnvMap constructs either a VertexClient or LocalClient using the provided env lookup.
func NewFromEnvMap(lookup func(string) string) Provider {
	if strings.EqualFold(strings.TrimSpace(lookup("AI_PROVIDER")), "vertex") {
		model := strings.TrimSpace(lookup("VERTEX_MODEL"))
		if model == "" {
			model = DefaultVertexModel
		}
		embedModel := strings.TrimSpace(lookup("VERTEX_EMBED_MODEL"))
		if embedModel == "" {
			embedModel = DefaultVertexEmbedModel
		}
		location := normalizeVertexLocation(lookup("GCP_LOCATION"))
		thinkingLevel := strings.TrimSpace(lookup("VERTEX_THINKING_LEVEL"))
		if thinkingLevel == "" {
			thinkingLevel = DefaultVertexThinkingLevel
		}
		var budget *int
		if rawBudget := strings.TrimSpace(lookup("VERTEX_THINKING_BUDGET")); rawBudget != "" {
			if parsed, err := ParseVertexThinkingBudget(rawBudget); err == nil {
				budget = parsed
			}
		}
		return &VertexClient{
			ProjectID:        strings.TrimSpace(lookup("GCP_PROJECT_ID")),
			Location:         location,
			Model:            model,
			EmbedModel:       embedModel,
			ThinkingLevel:    thinkingLevel,
			AccessToken:      strings.TrimSpace(lookup("GOOGLE_OAUTH_ACCESS_TOKEN")),
			MetadataURL:      strings.TrimSpace(lookup("GCP_METADATA_TOKEN_URL")),
			ThinkingBudget:   budget,
			HTTPClient:       &http.Client{Timeout: 30 * time.Second},
			StreamHTTPClient: newDefaultStreamHTTPClient(nil),
		}
	}
	baseURL := strings.TrimSpace(lookup("LOCAL_LLM_BASE_URL"))
	if baseURL == "" {
		baseURL = DefaultLocalBaseURL
	}
	return &LocalClient{
		BaseURL:          baseURL,
		ChatModel:        strings.TrimSpace(lookup("LOCAL_LLM_CHAT_MODEL")),
		EmbedModel:       strings.TrimSpace(lookup("LOCAL_LLM_EMBED_MODEL")),
		HTTPClient:       &http.Client{Timeout: localHTTPTimeout()},
		StreamHTTPClient: newStreamHTTPClient(nil, localStreamResponseHeaderTTL()),
	}
}
