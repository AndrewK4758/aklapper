package privacy

import (
	"bytes"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"regexp"
	"sort"
	"strings"
	"unicode/utf8"
)

// ParsedDenylist holds normalized, sorted, deduplicated denylist terms and their canonical SHA-256 hash.
type ParsedDenylist struct {
	Terms        []string
	DenylistHash string
	Configured   bool
}

type compiledDenylistTerm struct {
	ruleID       string
	wordRe       *regexp.Regexp
	obfuscatedRe *regexp.Regexp
	collapsed    string
}

var base64CharsRe = regexp.MustCompile(`^[A-Za-z0-9+/]+={0,2}$`)

// ComputeDenylistHash computes SHA-256(JSON(sorted_unique_normalized)) matching Node JSON.stringify byte-for-byte.
func ComputeDenylistHash(terms []string) string {
	seen := make(map[string]struct{}, len(terms))
	canonical := make([]string, 0, len(terms))
	for _, t := range terms {
		norm := NormalizePrivacyTerm(t)
		if norm == "" {
			continue
		}
		if _, dup := seen[norm]; dup {
			continue
		}
		seen[norm] = struct{}{}
		canonical = append(canonical, norm)
	}
	sort.Strings(canonical)

	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)
	enc.SetEscapeHTML(false)
	_ = enc.Encode(canonical)
	encoded := bytes.TrimSuffix(buf.Bytes(), []byte("\n"))
	sum := sha256.Sum256(encoded)
	return hex.EncodeToString(sum[:])
}

func decodeBase64JSONCandidate(compact string) (string, bool) {
	if compact == "" || len(compact)%4 == 1 || !base64CharsRe.MatchString(compact) {
		return "", false
	}
	padded := compact
	if rem := len(compact) % 4; rem != 0 {
		padded += strings.Repeat("=", 4-rem)
	}
	decoded, err := base64.StdEncoding.DecodeString(padded)
	if err != nil {
		return "", false
	}
	return strings.TrimSpace(string(decoded)), true
}

func parseJSONStringArrayTerms(rawJSON string) ([]string, bool) {
	var rawList []any
	if err := json.Unmarshal([]byte(rawJSON), &rawList); err != nil || rawList == nil {
		return nil, false
	}
	seen := make(map[string]struct{}, len(rawList))
	out := make([]string, 0, len(rawList))
	for _, entry := range rawList {
		s, ok := entry.(string)
		if !ok {
			return nil, false
		}
		norm := NormalizePrivacyTerm(s)
		if utf8.RuneCountInString(norm) < 2 {
			continue
		}
		if _, dup := seen[norm]; dup {
			continue
		}
		seen[norm] = struct{}{}
		out = append(out, norm)
	}
	sort.Strings(out)
	return out, true
}

func malformedDenylistError() *PolicyError {
	return &PolicyError{
		Findings: []Finding{
			{
				RuleID:   "config.malformed_denylist",
				Category: "config",
				Field:    "DOSSIER_PRIVACY_DENYLIST",
				Location: "env",
			},
		},
	}
}

// ParseDossierPrivacyDenylist parses a JSON array or base64-encoded JSON array denylist.
func ParseDossierPrivacyDenylist(rawEnv string) (ParsedDenylist, error) {
	trimmed := strings.TrimSpace(rawEnv)
	if trimmed == "" {
		return ParsedDenylist{
			Terms:        []string{},
			DenylistHash: ComputeDenylistHash(nil),
			Configured:   false,
		}, nil
	}

	var parsedTerms []string
	var ok bool
	if strings.HasPrefix(trimmed, "[") {
		parsedTerms, ok = parseJSONStringArrayTerms(trimmed)
	} else {
		compact := strings.Join(strings.Fields(trimmed), "")
		if decoded, decOK := decodeBase64JSONCandidate(compact); decOK && strings.HasPrefix(decoded, "[") {
			parsedTerms, ok = parseJSONStringArrayTerms(decoded)
		}
	}
	if !ok {
		return ParsedDenylist{}, malformedDenylistError()
	}
	return ParsedDenylist{
		Terms:        parsedTerms,
		DenylistHash: ComputeDenylistHash(parsedTerms),
		Configured:   len(parsedTerms) > 0,
	}, nil
}

// ParseDenylistFileContent parses JSON array, single-line base64 JSON array, or newline-delimited denylist files.
func ParseDenylistFileContent(rawContent string) (ParsedDenylist, error) {
	trimmed := strings.TrimSpace(rawContent)
	if trimmed == "" {
		return ParsedDenylist{
			Terms:        []string{},
			DenylistHash: ComputeDenylistHash(nil),
			Configured:   false,
		}, nil
	}
	if strings.HasPrefix(trimmed, "[") {
		return ParseDossierPrivacyDenylist(trimmed)
	}
	rawLines := strings.Split(strings.ReplaceAll(trimmed, "\r\n", "\n"), "\n")
	lines := make([]string, 0, len(rawLines))
	for _, line := range rawLines {
		s := strings.TrimSpace(line)
		if s == "" || strings.HasPrefix(s, "#") {
			continue
		}
		lines = append(lines, s)
	}
	if len(lines) == 1 {
		if decoded, ok := decodeBase64JSONCandidate(lines[0]); ok && strings.HasPrefix(decoded, "[") {
			return ParseDossierPrivacyDenylist(lines[0])
		}
	}
	seen := make(map[string]struct{}, len(lines))
	normalized := make([]string, 0, len(lines))
	for _, line := range lines {
		norm := NormalizePrivacyTerm(line)
		if utf8.RuneCountInString(norm) < 2 {
			continue
		}
		if _, dup := seen[norm]; dup {
			continue
		}
		seen[norm] = struct{}{}
		normalized = append(normalized, norm)
	}
	sort.Strings(normalized)
	return ParsedDenylist{
		Terms:        normalized,
		DenylistHash: ComputeDenylistHash(normalized),
		Configured:   len(normalized) > 0,
	}, nil
}

// LoadPolicyDenylistFromEnv loads DOSSIER_PRIVACY_DENYLIST for fail-closed policy enforcement.
func LoadPolicyDenylistFromEnv() (ParsedDenylist, error) {
	return ParseDossierPrivacyDenylist(os.Getenv("DOSSIER_PRIVACY_DENYLIST"))
}

func compileDenylistTerms(terms []string) []compiledDenylistTerm {
	if len(terms) == 0 {
		return nil
	}
	out := make([]compiledDenylistTerm, 0, len(terms))
	for idx, term := range terms {
		folded := strings.ToLower(strings.TrimSpace(FoldDiacriticsAndInvisible(term)))
		parts := strings.Fields(folded)
		escaped := make([]string, len(parts))
		for i, p := range parts {
			escaped[i] = regexp.QuoteMeta(p)
		}
		var wordRe *regexp.Regexp
		if len(escaped) > 0 {
			wordRe = regexp.MustCompile(`(?i)` + strings.Join(escaped, `[\s_./-]+`))
		}
		collapsed := CollapseForSeparatorMatch(term)
		var obfRe *regexp.Regexp
		if len(collapsed) >= 2 && len(collapsed) < 6 {
			chars := make([]string, 0, len(collapsed))
			for _, r := range collapsed {
				chars = append(chars, regexp.QuoteMeta(string(r)))
			}
			obfRe = regexp.MustCompile(`(?i)` + strings.Join(chars, `[\s_./-]*`))
		}
		out = append(out, compiledDenylistTerm{
			ruleID:       fmt.Sprintf("denylist.term_%d", idx+1),
			wordRe:       wordRe,
			obfuscatedRe: obfRe,
			collapsed:    collapsed,
		})
	}
	return out
}
