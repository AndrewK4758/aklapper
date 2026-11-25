package privacy

import (
	"regexp"
	"strings"
	"unicode"
	"unicode/utf8"

	"golang.org/x/text/unicode/norm"
)

const (
	maxRawPendingRunes     = 4096
	maxConsecutiveSepRunes = 64
)

type builtInSecretRule struct {
	name        string
	regex       *regexp.Regexp
	fingerprint string
}

var (
	builtInSecretRules = []builtInSecretRule{
		{
			name:        "pem_private_key",
			regex:       regexp.MustCompile(`-----BEGIN [A-Z0-9 ]{0,24}PRIVATE KEY-----`),
			fingerprint: ruleFingerprint("builtin", 0, "pem_private_key"),
		},
		{
			name:        "credentialed_url",
			regex:       regexp.MustCompile(`(?i)\b(?:postgres(?:ql)?|mysql|redis|mongodb(?:\+srv)?|amqp|https?)://[^\s:@"'<>]{1,40}:[^\s@"'<>]{1,64}@[^\s"'<>]{1,64}`),
			fingerprint: ruleFingerprint("builtin", 1, "credentialed_url"),
		},
		{
			name:        "google_api_key",
			regex:       regexp.MustCompile(`AIza[0-9A-Za-z_-]{35}`),
			fingerprint: ruleFingerprint("builtin", 2, "google_api_key"),
		},
		{
			name:        "github_token",
			regex:       regexp.MustCompile(`\b(?:ghp_[0-9A-Za-z]{36}|github_pat_[0-9A-Za-z_]{22,82})\b`),
			fingerprint: ruleFingerprint("builtin", 3, "github_token"),
		},
		{
			name:        "jwt_token",
			regex:       regexp.MustCompile(`eyJ[A-Za-z0-9_-]{10,60}\.eyJ[A-Za-z0-9_-]{10,60}\.[A-Za-z0-9_-]{10,60}`),
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

// StreamGuard inspects incremental stream chunks with a rolling holdback window,
// catching split denylist terms, Unicode/separator obfuscation, and built-in secret patterns.
type StreamGuard struct {
	cfg           *Config
	correlationID string
	pending       []rune
	aborted       bool
}

// NewStreamGuard constructs a fresh per-stream guard instance.
func NewStreamGuard(cfg *Config, correlationID string) *StreamGuard {
	if cfg == nil {
		cfg, _ = LoadConfig(ConfigInput{})
	}
	return &StreamGuard{
		cfg:           cfg,
		correlationID: correlationID,
	}
}

// Process ingests the next incremental chunk and returns only text proven safe to emit.
func (g *StreamGuard) Process(chunk string) (string, error) {
	if g.aborted {
		return "", ErrPrivacyAborted
	}
	if chunk != "" {
		g.pending = append(g.pending, []rune(chunk)...)
		g.collapseExtremeSeparators()
	}
	if err := g.applyRules(); err != nil {
		return "", err
	}
	flushEnd := g.safeFlushIndex()
	if flushEnd <= 0 {
		return "", nil
	}
	safe := string(g.pending[:flushEnd])
	g.pending = append([]rune(nil), g.pending[flushEnd:]...)
	return safe, nil
}

// Flush validates and releases any remaining held-back tail at stream EOF.
func (g *StreamGuard) Flush() (string, error) {
	if g.aborted {
		return "", ErrPrivacyAborted
	}
	if err := g.applyRules(); err != nil {
		return "", err
	}
	if len(g.pending) == 0 {
		return "", nil
	}
	out := string(g.pending)
	g.pending = nil
	return out, nil
}

func (g *StreamGuard) collapseExtremeSeparators() {
	if len(g.pending) <= maxRawPendingRunes {
		return
	}
	out := make([]rune, 0, len(g.pending))
	sepRun := 0
	for _, r := range g.pending {
		if isSeparatorRune(r) {
			sepRun++
			if sepRun <= maxConsecutiveSepRunes {
				out = append(out, r)
			}
			continue
		}
		sepRun = 0
		out = append(out, r)
	}
	g.pending = out
}

func (g *StreamGuard) recordTrigger(category string, action Action, fingerprint string) {
	logPrivacySeam("BOUNDARY_FAULT", "privacy.stream_guard.triggered", map[string]any{
		"ruleCategory":    category,
		"action":          string(action),
		"correlationId":   g.correlationID,
		"ruleFingerprint": fingerprint,
	})
}

func (g *StreamGuard) applyRules() error {
	for {
		// 1. Always-on built-in secret patterns (highest precedence).
		rawStr := string(g.pending)
		matchedSecret := false
		for _, rule := range builtInSecretRules {
			loc := rule.regex.FindStringIndex(rawStr)
			if loc == nil {
				continue
			}
			g.recordTrigger("builtin_secret", g.cfg.SecretAction, rule.fingerprint)
			if g.cfg.SecretAction == ActionAbort {
				g.pending = nil
				g.aborted = true
				return ErrPrivacyAborted
			}
			startRune := utf8.RuneCountInString(rawStr[:loc[0]])
			endRune := startRune + utf8.RuneCountInString(rawStr[loc[0]:loc[1]])
			g.replacePendingSpan(startRune, endRune)
			matchedSecret = true
			break
		}
		if matchedSecret {
			continue
		}

		// 2. Configured runtime denylist (normalized non-separator literals + bounded regexes).
		if len(g.cfg.rules) == 0 {
			return nil
		}
		matchedDenylist := false
		normStr, normMap := buildNormalizedMap(g.pending)
		for _, rule := range g.cfg.rules {
			var startRune, endRune int
			found := false
			if rule.regex != nil {
				if loc := rule.regex.FindStringIndex(rawStr); loc != nil {
					startRune = utf8.RuneCountInString(rawStr[:loc[0]])
					endRune = startRune + utf8.RuneCountInString(rawStr[loc[0]:loc[1]])
					found = true
				}
			} else if rule.normalized != "" {
				if idx := strings.Index(normStr, rule.normalized); idx >= 0 {
					startNormRune := utf8.RuneCountInString(normStr[:idx])
					endNormRune := startNormRune + utf8.RuneCountInString(rule.normalized)
					if endNormRune > startNormRune && endNormRune <= len(normMap) {
						startRune = normMap[startNormRune].rawStart
						endRune = normMap[endNormRune-1].rawEnd
						found = true
					}
				}
			}
			if !found {
				continue
			}
			g.recordTrigger("denylist", g.cfg.DenylistAction, rule.fingerprint)
			if g.cfg.DenylistAction == ActionAbort {
				g.pending = nil
				g.aborted = true
				return ErrPrivacyAborted
			}
			g.replacePendingSpan(startRune, endRune)
			matchedDenylist = true
			break
		}
		if !matchedDenylist {
			return nil
		}
	}
}

func (g *StreamGuard) replacePendingSpan(startRune, endRune int) {
	placeholder := []rune(RedactionPlaceholder)
	updated := make([]rune, 0, len(g.pending)-(endRune-startRune)+len(placeholder))
	updated = append(updated, g.pending[:startRune]...)
	updated = append(updated, placeholder...)
	updated = append(updated, g.pending[endRune:]...)
	g.pending = updated
}

type normRuneSpan struct {
	rawStart int
	rawEnd   int
}

func buildNormalizedMap(raw []rune) (string, []normRuneSpan) {
	var b strings.Builder
	spans := make([]normRuneSpan, 0, len(raw))
	for i, r := range raw {
		if isSeparatorRune(r) {
			continue
		}
		expanded := norm.NFKC.String(string(r))
		for _, nr := range expanded {
			if isSeparatorRune(nr) {
				continue
			}
			b.WriteRune(unicode.ToLower(nr))
			spans = append(spans, normRuneSpan{rawStart: i, rawEnd: i + 1})
		}
	}
	return b.String(), spans
}

func (g *StreamGuard) safeFlushIndex() int {
	n := len(g.pending)
	if n == 0 {
		return 0
	}

	// Constraint 1: adaptive built-in secret holdback (16-rune anchor baseline, up to 128 runes when anchor enters window).
	safeSecret := max(0, n-BaselineSecretAnchorRunes)
	lowerRunes := make([]rune, n)
	for i, r := range g.pending {
		lowerRunes[i] = unicode.ToLower(r)
	}
	lowerStr := string(lowerRunes)
	for _, anchor := range secretAnchorPrefixes {
		searchFrom := 0
		for {
			rel := strings.Index(lowerStr[searchFrom:], anchor)
			if rel < 0 {
				break
			}
			bytePos := searchFrom + rel
			runePos := utf8.RuneCountInString(lowerStr[:bytePos])
			if n-runePos <= MaxSecretHoldbackRunes && runePos < safeSecret {
				safeSecret = runePos
			}
			searchFrom = bytePos + len(anchor)
		}
	}

	// Constraint 2: non-separator normalized denylist holdback (blocks separator flooding).
	safeDenylist := n
	if g.cfg.maxDenylistNonSep > 0 {
		_, spans := buildNormalizedMap(g.pending)
		if len(spans) <= g.cfg.maxDenylistNonSep {
			safeDenylist = 0
		} else {
			keepFromNorm := len(spans) - g.cfg.maxDenylistNonSep
			safeDenylist = spans[keepFromNorm].rawStart
		}
	}

	if safeDenylist < safeSecret {
		return safeDenylist
	}
	return safeSecret
}
