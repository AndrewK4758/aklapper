package llm

import (
	"fmt"
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
