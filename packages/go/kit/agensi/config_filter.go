package agensi

import (
	"encoding/json"
	"log"
	"net/url"
	"os"
	"strconv"
	"strings"
	"unicode/utf8"
)

const (
	DefaultBaseURL         = "https://www.agensi.io"
	DefaultCreatorHandle   = "aklapper"
	DefaultCacheTTLSeconds = 300
	DefaultFetchTimeoutMs  = 1800
	MinFetchTimeoutMs      = 250
	MaxFetchTimeoutMs      = 2000
	MaxPages               = 10
	MaxRedirects           = 3
	MaxResponseBytes       = 512 * 1024
	CanonicalSkillOrigin   = "https://agensi.io/skills/"
)

var DefaultAllowedOrigins = []string{"https://agensi.io", "https://www.agensi.io"}

type Config struct {
	BaseURL        string
	APIPath        string
	CreatorHandle  string
	APIKey         string
	TTLSeconds     int
	TimeoutMs      int
	MaxPages       int
	AllowedOrigins []string
}

func EmitSeamLog(seamType, event string, detail map[string]any) {
	payload := make(map[string]any, len(detail)+2)
	for k, v := range detail {
		payload[k] = v
	}
	payload["seam_type"] = seamType
	payload["event"] = event
	if raw, err := json.Marshal(payload); err == nil {
		log.Println(string(raw))
	}
}

func ScrubSecret(message, apiKey string) string {
	trimmed := strings.TrimSpace(apiKey)
	out := message
	if trimmed != "" {
		out = strings.ReplaceAll(out, trimmed, "[REDACTED]")
	}
	if utf8.RuneCountInString(out) > 300 {
		return string([]rune(out)[:300])
	}
	return out
}

func IsLoopbackHost(hostname string) bool {
	switch strings.ToLower(strings.TrimSpace(hostname)) {
	case "127.0.0.1", "localhost", "::1", "[::1]":
		return true
	default:
		return false
	}
}

func NormalizeAllowedOrigins(origins []string) map[string]struct{} {
	set := make(map[string]struct{}, len(origins))
	for _, raw := range origins {
		trimmed := strings.TrimSpace(raw)
		if trimmed == "" {
			continue
		}
		if parsed, err := url.Parse(trimmed); err == nil && parsed.Scheme != "" && parsed.Host != "" {
			set[strings.ToLower(parsed.Scheme+"://"+parsed.Host)] = struct{}{}
			continue
		}
		set[strings.ToLower(strings.TrimRight(trimmed, "/"))] = struct{}{}
	}
	return set
}

func ClampFetchTimeoutMs(rawMs int, hasValue bool) int {
	if !hasValue {
		return DefaultFetchTimeoutMs
	}
	if rawMs < MinFetchTimeoutMs {
		return MinFetchTimeoutMs
	}
	if rawMs > MaxFetchTimeoutMs {
		return MaxFetchTimeoutMs
	}
	return rawMs
}

func ValidateUpstreamBaseURL(raw string) string {
	parsed, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || parsed.User != nil || parsed.Host == "" {
		return ""
	}
	scheme := strings.ToLower(parsed.Scheme)
	if scheme != "https" && !(scheme == "http" && IsLoopbackHost(parsed.Hostname())) {
		return ""
	}
	path := strings.TrimRight(parsed.Path, "/")
	return scheme + "://" + strings.ToLower(parsed.Host) + path
}

func ResolveCreatorHandleFromEnv() string {
	if h := strings.TrimSpace(os.Getenv("AGENSI_CREATOR_HANDLE")); h != "" {
		return h
	}
	return DefaultCreatorHandle
}

func ResolveConfigFromEnv() Config {
	return ResolveConfigFromLookup(os.LookupEnv)
}

func ResolveConfigFromLookup(lookup func(string) (string, bool)) Config {
	creatorHandle := DefaultCreatorHandle
	if v, ok := lookup("AGENSI_CREATOR_HANDLE"); ok && strings.TrimSpace(v) != "" {
		creatorHandle = strings.TrimSpace(v)
	}

	var baseURL string
	disabledVal, _ := lookup("AGENSI_SYNC_DISABLED")
	disabledNorm := strings.ToLower(strings.TrimSpace(disabledVal))
	if disabledNorm == "true" || disabledNorm == "1" {
		baseURL = ""
	} else if rawBase, exists := lookup("AGENSI_API_BASE_URL"); exists {
		trimmed := strings.TrimSpace(rawBase)
		switch strings.ToLower(trimmed) {
		case "", "off", "disabled", "none":
			baseURL = ""
		default:
			baseURL = ValidateUpstreamBaseURL(trimmed)
		}
	} else {
		baseURL = DefaultBaseURL
	}

	apiPath := "/creators/" + url.PathEscape(creatorHandle)
	if rawPath, ok := lookup("AGENSI_API_PATH"); ok && strings.TrimSpace(rawPath) != "" {
		apiPath = strings.TrimSpace(rawPath)
	}

	apiKey := ""
	if rawKey, ok := lookup("AGENSI_API_KEY"); ok {
		apiKey = strings.TrimSpace(rawKey)
	}

	ttlSeconds := DefaultCacheTTLSeconds
	if rawTTL, ok := lookup("AGENSI_CACHE_TTL_SECONDS"); ok && strings.TrimSpace(rawTTL) != "" {
		if parsed, err := strconv.Atoi(strings.TrimSpace(rawTTL)); err == nil && parsed >= 0 {
			ttlSeconds = parsed
		}
	}

	timeoutMs := DefaultFetchTimeoutMs
	if rawTO, ok := lookup("AGENSI_FETCH_TIMEOUT_MS"); ok && strings.TrimSpace(rawTO) != "" {
		if parsed, err := strconv.Atoi(strings.TrimSpace(rawTO)); err == nil {
			timeoutMs = ClampFetchTimeoutMs(parsed, true)
		}
	}

	allowed := append([]string(nil), DefaultAllowedOrigins...)
	if rawOrigins, ok := lookup("AGENSI_ALLOWED_ORIGINS"); ok && strings.TrimSpace(rawOrigins) != "" {
		parts := strings.Split(rawOrigins, ",")
		parsedOrigins := make([]string, 0, len(parts))
		for _, p := range parts {
			if cleaned := strings.TrimRight(strings.TrimSpace(p), "/"); cleaned != "" {
				parsedOrigins = append(parsedOrigins, cleaned)
			}
		}
		if len(parsedOrigins) > 0 {
			allowed = parsedOrigins
		}
	}

	return Config{
		BaseURL:        baseURL,
		APIPath:        apiPath,
		CreatorHandle:  creatorHandle,
		APIKey:         apiKey,
		TTLSeconds:     ttlSeconds,
		TimeoutMs:      timeoutMs,
		MaxPages:       MaxPages,
		AllowedOrigins: allowed,
	}
}
