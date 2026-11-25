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
			regex:       regexp.MustCompile(`eyJ[A-Za-z0-9_-]{10,80}\.eyJ[A-Za-z0-9_-]{10,32}(?:[A-Za-z0-9_-]{0,900}(?:\.[A-Za-z0-9_-]{0,900})?)?`),
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

type guardRune struct {
	r        rune
	redacted bool
}

// StreamGuard inspects incremental stream chunks with a rolling holdback window,
// catching split denylist terms, Unicode/separator obfuscation, and built-in secret patterns.
type StreamGuard struct {
	cfg           *Config
	correlationID string
	pending       []guardRune
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

func pendingToString(items []guardRune) string {
	out := make([]rune, len(items))
	for i, item := range items {
		out[i] = item.r
	}
	return string(out)
}

func isCombiningMark(r rune) bool {
	return unicode.Is(unicode.Mn, r) || unicode.Is(unicode.Mc, r) || unicode.Is(unicode.Me, r)
}

// Process ingests the next incremental chunk and returns only text proven safe to emit.
func (g *StreamGuard) Process(chunk string) (string, error) {
	if g.aborted {
		return "", ErrPrivacyAborted
	}
	if chunk != "" {
		for _, r := range chunk {
			g.pending = append(g.pending, guardRune{r: r})
		}
		g.collapseExtremeSeparators()
	}
	if err := g.applyRules(); err != nil {
		return "", err
	}
	flushEnd := g.safeFlushIndex()
	if flushEnd <= 0 {
		return "", nil
	}
	safe := pendingToString(g.pending[:flushEnd])
	g.pending = append([]guardRune(nil), g.pending[flushEnd:]...)
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
	out := pendingToString(g.pending)
	g.pending = nil
	return out, nil
}

func (g *StreamGuard) collapseExtremeSeparators() {
	if len(g.pending) <= maxRawPendingRunes {
		return
	}
	out := make([]guardRune, 0, len(g.pending))
	sepRun := 0
	for _, item := range g.pending {
		if !item.redacted && isSeparatorRune(item.r) {
			sepRun++
			if sepRun <= maxConsecutiveSepRunes {
				out = append(out, item)
			}
			continue
		}
		sepRun = 0
		out = append(out, item)
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

type runeSegment struct {
	start int
	end   int
}

func unredactedSegments(items []guardRune) []runeSegment {
	var segs []runeSegment
	i := 0
	for i < len(items) {
		if items[i].redacted {
			i++
			continue
		}
		start := i
		for i < len(items) && !items[i].redacted {
			i++
		}
		segs = append(segs, runeSegment{start: start, end: i})
	}
	return segs
}

func (g *StreamGuard) applyRules() error {
	maxIter := len(g.pending) + 64
	for iter := 0; iter < maxIter; iter++ {
		segs := unredactedSegments(g.pending)
		if len(segs) == 0 {
			return nil
		}

		// 1. Always-on built-in secret patterns (highest precedence, unredacted spans only).
		matchedSecret := false
		for _, seg := range segs {
			segStr := pendingToString(g.pending[seg.start:seg.end])
			for _, rule := range builtInSecretRules {
				loc := rule.regex.FindStringIndex(segStr)
				if loc == nil {
					continue
				}
				g.recordTrigger("builtin_secret", g.cfg.SecretAction, rule.fingerprint)
				if g.cfg.SecretAction == ActionAbort {
					g.pending = nil
					g.aborted = true
					return ErrPrivacyAborted
				}
				startRune := seg.start + utf8.RuneCountInString(segStr[:loc[0]])
				endRune := startRune + utf8.RuneCountInString(segStr[loc[0]:loc[1]])
				g.replacePendingSpan(startRune, endRune)
				matchedSecret = true
				break
			}
			if matchedSecret {
				break
			}
		}
		if matchedSecret {
			continue
		}

		// 2. Configured runtime denylist (normalized non-separator literals + bounded regexes).
		if len(g.cfg.rules) == 0 {
			return nil
		}
		matchedDenylist := false
		for _, seg := range segs {
			segSlice := g.pending[seg.start:seg.end]
			segStr := pendingToString(segSlice)
			normStr, normMap := buildNormalizedMap(segSlice)
			for _, rule := range g.cfg.rules {
				var startRune, endRune int
				found := false
				if rule.regex != nil {
					if loc := rule.regex.FindStringIndex(segStr); loc != nil {
						startRune = seg.start + utf8.RuneCountInString(segStr[:loc[0]])
						endRune = startRune + utf8.RuneCountInString(segStr[loc[0]:loc[1]])
						found = true
					}
				} else if rule.normalized != "" {
					if idx := strings.Index(normStr, rule.normalized); idx >= 0 {
						startNormRune := utf8.RuneCountInString(normStr[:idx])
						endNormRune := startNormRune + utf8.RuneCountInString(rule.normalized)
						if endNormRune > startNormRune && endNormRune <= len(normMap) {
							startRune = seg.start + normMap[startNormRune].rawStart
							endRune = seg.start + normMap[endNormRune-1].rawEnd
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
			if matchedDenylist {
				break
			}
		}
		if !matchedDenylist {
			return nil
		}
	}
	g.pending = nil
	g.aborted = true
	return ErrPrivacyAborted
}

func (g *StreamGuard) replacePendingSpan(startRune, endRune int) {
	placeholderRunes := []rune(RedactionPlaceholder)
	updated := make([]guardRune, 0, len(g.pending)-(endRune-startRune)+len(placeholderRunes))
	updated = append(updated, g.pending[:startRune]...)
	for _, r := range placeholderRunes {
		updated = append(updated, guardRune{r: r, redacted: true})
	}
	updated = append(updated, g.pending[endRune:]...)
	g.pending = updated
}

type normRuneSpan struct {
	rawStart int
	rawEnd   int
}

func buildNormalizedMap(raw []guardRune) (string, []normRuneSpan) {
	var b strings.Builder
	spans := make([]normRuneSpan, 0, len(raw))
	for i := 0; i < len(raw); {
		if raw[i].redacted || isSeparatorRune(raw[i].r) {
			i++
			continue
		}
		j := i + 1
		for j < len(raw) && !raw[j].redacted && isCombiningMark(raw[j].r) {
			j++
		}
		cluster := pendingToString(raw[i:j])
		expanded := norm.NFKC.String(cluster)
		for _, nr := range expanded {
			if isSeparatorRune(nr) {
				continue
			}
			b.WriteRune(unicode.ToLower(nr))
			spans = append(spans, normRuneSpan{rawStart: i, rawEnd: j})
		}
		i = j
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
	for i, item := range g.pending {
		if item.redacted {
			lowerRunes[i] = ' '
		} else {
			lowerRunes[i] = unicode.ToLower(item.r)
		}
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

	// Constraint 2: non-separator normalized denylist holdback (unredacted runes only; blocks separator flooding).
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

	flushEnd := safeSecret
	if safeDenylist < flushEnd {
		flushEnd = safeDenylist
	}
	// Never split an already-buffered combining mark cluster at the flush boundary.
	for flushEnd > 0 && flushEnd < n && !g.pending[flushEnd].redacted && isCombiningMark(g.pending[flushEnd].r) {
		flushEnd--
	}
	return flushEnd
}
