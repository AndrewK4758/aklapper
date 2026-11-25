package privacy

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"regexp"
	"strings"
)

const DefaultStorageMaxRunes = 1000

var storageExtraRedactPatterns = []*regexp.Regexp{
	regexp.MustCompile(`\bAKIA[0-9A-Z]{16}\b`),
	regexp.MustCompile(`\bsk-[A-Za-z0-9]{20,}\b`),
	regexp.MustCompile(`\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b`),
	regexp.MustCompile(`(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b`),
}

func parseDossierDenylistEnv(raw string) ([]string, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return nil, nil
	}
	payload := trimmed
	if !strings.HasPrefix(payload, "[") {
		decoded, err := base64.StdEncoding.DecodeString(strings.ReplaceAll(trimmed, " ", ""))
		if err != nil {
			return nil, errors.New("invalid base64 encoding in DOSSIER_PRIVACY_DENYLIST")
		}
		payload = strings.TrimSpace(string(decoded))
	}
	var list []string
	if err := json.Unmarshal([]byte(payload), &list); err != nil {
		return nil, errors.New("invalid JSON string array in DOSSIER_PRIVACY_DENYLIST")
	}
	out := make([]string, 0, len(list))
	for _, item := range list {
		if s := strings.TrimSpace(item); s != "" {
			out = append(out, s)
		}
	}
	return out, nil
}

// resolveEnvDenylistRaw merges AI_PRIVACY_DENYLIST (or AI_PRIVACY_DENYLIST_FILE) with
// single-line base64-JSON (or plain JSON fallback) DOSSIER_PRIVACY_DENYLIST into one JSON array.
func resolveEnvDenylistRaw() (string, error) {
	rawAI := strings.TrimSpace(os.Getenv("AI_PRIVACY_DENYLIST"))
	if rawAI == "" {
		if filePath := strings.TrimSpace(os.Getenv("AI_PRIVACY_DENYLIST_FILE")); filePath != "" {
			data, err := os.ReadFile(filePath)
			if err != nil {
				return "", fmt.Errorf("read AI_PRIVACY_DENYLIST_FILE: %w", err)
			}
			rawAI = string(data)
		}
	}

	aiEntries, err := parseRawEntries(rawAI)
	if err != nil {
		return "", err
	}
	dossierEntries, err := parseDossierDenylistEnv(os.Getenv("DOSSIER_PRIVACY_DENYLIST"))
	if err != nil {
		return "", err
	}
	if len(aiEntries) == 0 && len(dossierEntries) == 0 {
		return "", nil
	}

	merged := make([]string, 0, len(aiEntries)+len(dossierEntries))
	seen := make(map[string]struct{}, len(aiEntries)+len(dossierEntries))
	for _, entry := range append(aiEntries, dossierEntries...) {
		key := strings.ToLower(strings.TrimSpace(entry))
		if key == "" {
			continue
		}
		if _, dup := seen[key]; dup {
			continue
		}
		seen[key] = struct{}{}
		merged = append(merged, entry)
	}
	encoded, err := json.Marshal(merged)
	if err != nil {
		return "", err
	}
	return string(encoded), nil
}

// RedactTextForStorage scrubs configured denylist terms, built-in secret patterns, credentials,
// and PII from visitor prompt text before persisting to ask_turns.prompt_text, capped at maxRunes.
func RedactTextForStorage(cfg *Config, raw string, maxRunes int) string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return ""
	}
	if maxRunes <= 0 {
		maxRunes = DefaultStorageMaxRunes
	}

	redactCfg := &Config{
		DenylistAction:      ActionRedact,
		SecretAction:        ActionRedact,
		BuiltInSecretActive: true,
	}
	if cfg != nil {
		redactCfg.rules = cfg.rules
		redactCfg.maxDenylistNonSep = cfg.maxDenylistNonSep
		redactCfg.DenylistTermCount = cfg.DenylistTermCount
	}

	guard := NewStreamGuard(redactCfg, "storage-redact")
	var out strings.Builder
	if safe, err := guard.Process(trimmed); err == nil {
		out.WriteString(safe)
	} else {
		return RedactionPlaceholder
	}
	if tail, err := guard.Flush(); err == nil {
		out.WriteString(tail)
	} else {
		return RedactionPlaceholder
	}

	cleaned := out.String()
	for _, re := range storageExtraRedactPatterns {
		cleaned = re.ReplaceAllString(cleaned, RedactionPlaceholder)
	}
	cleaned = strings.TrimSpace(cleaned)

	runes := []rune(cleaned)
	if len(runes) > maxRunes {
		return string(runes[:maxRunes])
	}
	return cleaned
}
