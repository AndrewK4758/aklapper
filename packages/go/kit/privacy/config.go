package privacy

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"regexp"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/AndrewK4758/aklapper/packages/go/kit/internalauth"
	"golang.org/x/text/unicode/norm"
)

type Action string

const (
	ActionRedact Action = "redact"
	ActionAbort  Action = "abort"

	MaxNormalizedDenylistRunes = 128
	BaselineSecretAnchorRunes  = 16
	MaxSecretHoldbackRunes     = 128
	RedactionPlaceholder       = "[REDACTED]"
)

var (
	// ErrPrivacyAborted is returned when a fail-closed privacy rule halts stream emission.
	ErrPrivacyAborted = errors.New("stream aborted by privacy guard")

	unboundedQuantifierRe = regexp.MustCompile(`(^|[^\\])(?:\.\*|\.\+|\{\d+,\})`)

	builtInSecretRules = []builtInSecretRule{
		{
			name:        "pem_private_key",
			regex:       regexp.MustCompile(`-----BEGIN [A-Z0-9 ]{0,24}PRIVATE KEY-----`),
			fingerprint: ruleFingerprint("builtin", 0, "pem_private_key"),
		},
		{
			name:        "credentialed_url",
			regex:       regexp.MustCompile(`(?i)(?:postgres(?:ql)?|mysql|redis|mongodb(?:\+srv)?|amqp|https?)://[^\s:@"'<>]{1,40}:[^\s@"'<>]{1,64}@[^\s"'<>]{1,64}`),
			fingerprint: ruleFingerprint("builtin", 1, "credentialed_url"),
		},
		{
			name:        "google_api_key",
			regex:       regexp.MustCompile(`AIza[0-9A-Za-z_-]{35}`),
			fingerprint: ruleFingerprint("builtin", 2, "google_api_key"),
		},
		{
			name:        "github_token",
			regex:       regexp.MustCompile(`(?:ghp_[0-9A-Za-z]{36}|github_pat_[0-9A-Za-z_]{22,82})`),
			fingerprint: ruleFingerprint("builtin", 3, "github_token"),
		},
		{
			name: "jwt_token",
			// Header up to 114 base64url chars (3+111) covers real GCP OIDC (102-char 40-hex kid) and
			// UUID-kid RS256 headers while guaranteeing minimum trigger <= 128 runes (MaxSecretHoldbackRunes).
			regex:       regexp.MustCompile(`eyJ[A-Za-z0-9_-]{10,111}\.eyJ[A-Za-z0-9_-]{10,32}(?:[A-Za-z0-9_-]{0,900}(?:\.[A-Za-z0-9_-]{0,900})?)?`),
			fingerprint: ruleFingerprint("builtin", 4, "jwt_token"),
		},
	}

	secretAnchorPrefixes = []string{
		"-----begin",
		"postgresql://",
		"postgres://",
		"mongodb+srv://",
		"mongodb://",
		"mysql://",
		"redis://",
		"amqp://",
		"https://",
		"http://",
		"://",
		"eyj",
		"aiza",
		"ghp_",
		"github_pat_",
	}
)

type builtInSecretRule struct {
	name        string
	regex       *regexp.Regexp
	fingerprint string
}

// ConfigInput supplies raw denylist text and optional policy overrides.
type ConfigInput struct {
	RawDenylist    string
	DenylistAction Action
	SecretAction   Action
}

type denylistRule struct {
	normalized  string
	normLen     int
	regex       *regexp.Regexp
	fingerprint string
}

// Config holds compiled privacy rules and bounded holdback sizing.
type Config struct {
	rules               []denylistRule
	maxDenylistNonSep   int
	maxRegexRunes       int
	DenylistAction      Action
	SecretAction        Action
	DenylistTermCount   int
	BuiltInSecretActive bool
}

func ruleFingerprint(category string, idx int, canonical string) string {
	sum := sha256.Sum256([]byte(fmt.Sprintf("%s:%d:%s", category, idx, canonical)))
	return hex.EncodeToString(sum[:8])
}

func isSeparatorRune(r rune) bool {
	if unicode.IsSpace(r) {
		return true
	}
	switch r {
	case '-', '_', '\u200B', '\u200C', '\u200D', '\uFEFF', '\u00AD':
		return true
	default:
		return false
	}
}

func normalizeDenylistKey(raw string) string {
	nfkc := norm.NFKC.String(raw)
	var b strings.Builder
	for _, r := range nfkc {
		if isSeparatorRune(r) {
			continue
		}
		b.WriteRune(unicode.ToLower(r))
	}
	return b.String()
}

func parseRawEntries(raw string) ([]string, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return nil, nil
	}
	if strings.HasPrefix(trimmed, "[") {
		var list []string
		if err := json.Unmarshal([]byte(trimmed), &list); err != nil {
			return nil, fmt.Errorf("invalid JSON array in privacy denylist: %w", err)
		}
		out := make([]string, 0, len(list))
		for _, item := range list {
			if s := strings.TrimSpace(item); s != "" {
				out = append(out, s)
			}
		}
		return out, nil
	}
	lines := strings.Split(trimmed, "\n")
	out := make([]string, 0, len(lines))
	for _, line := range lines {
		s := strings.TrimSpace(line)
		if s == "" || strings.HasPrefix(s, "#") {
			continue
		}
		out = append(out, s)
	}
	return out, nil
}

func validateBoundedEntry(entry string) error {
	if unboundedQuantifierRe.MatchString(entry) {
		return fmt.Errorf("privacy denylist entry contains unbounded regex quantifier")
	}
	return nil
}

// LoadConfig parses and validates denylist entries, rejecting unbounded, empty-matchable,
// over-length, or context-anchored regexes fail-closed.
func LoadConfig(in ConfigInput) (*Config, error) {
	denylistAction := in.DenylistAction
	if denylistAction == "" {
		denylistAction = ActionRedact
	}
	secretAction := in.SecretAction
	if secretAction == "" {
		secretAction = ActionAbort
	}
	if denylistAction != ActionRedact && denylistAction != ActionAbort {
		return nil, fmt.Errorf("invalid denylist action %q", denylistAction)
	}
	if secretAction != ActionRedact && secretAction != ActionAbort {
		return nil, fmt.Errorf("invalid secret action %q", secretAction)
	}

	entries, err := parseRawEntries(in.RawDenylist)
	if err != nil {
		return nil, err
	}

	cfg := &Config{
		DenylistAction:      denylistAction,
		SecretAction:        secretAction,
		BuiltInSecretActive: true,
	}

	for i, entry := range entries {
		if strings.HasPrefix(entry, "re:") {
			expr := strings.TrimSpace(strings.TrimPrefix(entry, "re:"))
			if expr == "" {
				return nil, errors.New("empty regex entry in privacy denylist")
			}
			compiled, maxRunes, err := compileContextFreeDenylistRegex(i, expr)
			if err != nil {
				return nil, err
			}
			cfg.rules = append(cfg.rules, denylistRule{
				regex:       compiled,
				fingerprint: ruleFingerprint("denylist_re", i, expr),
			})
			if maxRunes > cfg.maxRegexRunes {
				cfg.maxRegexRunes = maxRunes
			}
			continue
		}

		if err := validateBoundedEntry(entry); err != nil {
			return nil, err
		}
		normKey := normalizeDenylistKey(entry)
		normLen := utf8.RuneCountInString(normKey)
		if normLen == 0 {
			continue
		}
		if normLen > MaxNormalizedDenylistRunes {
			return nil, fmt.Errorf("privacy denylist term exceeds max %d normalized runes", MaxNormalizedDenylistRunes)
		}
		cfg.rules = append(cfg.rules, denylistRule{
			normalized:  normKey,
			normLen:     normLen,
			fingerprint: ruleFingerprint("denylist", i, normKey),
		})
		if normLen > cfg.maxDenylistNonSep {
			cfg.maxDenylistNonSep = normLen
		}
	}
	cfg.DenylistTermCount = len(cfg.rules)
	return cfg, nil
}

// LoadConfigFromEnv loads AI_PRIVACY_DENYLIST (or AI_PRIVACY_DENYLIST_FILE) merged with
// DOSSIER_PRIVACY_DENYLIST (base64-JSON or plain JSON fallback) from the environment.
// Empty denylist in production is permitted with built-in secrets active plus a WARN audit event.
func LoadConfigFromEnv() (*Config, error) {
	raw, err := resolveEnvDenylistRaw()
	if err != nil {
		return nil, err
	}

	cfg, err := LoadConfig(ConfigInput{
		RawDenylist:    raw,
		DenylistAction: ActionRedact,
		SecretAction:   ActionAbort,
	})
	if err != nil {
		return nil, err
	}

	if cfg.DenylistTermCount == 0 && internalauth.IsProductionEnv() {
		logPrivacySeam("UNSOUND_CONDITION", "privacy.stream_guard.denylist_empty", map[string]any{
			"builtInSecretActive": true,
		})
	}
	return cfg, nil
}

func logPrivacySeam(seamType, event string, fields map[string]any) {
	payload := make(map[string]any, len(fields)+2)
	for k, v := range fields {
		payload[k] = v
	}
	payload["seam_type"] = seamType
	payload["event"] = event
	if raw, err := json.Marshal(payload); err == nil {
		log.Println(string(raw))
	}
}
