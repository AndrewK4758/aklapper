package privacy

import (
	"strings"
	"unicode"
	"unicode/utf8"
)

const (
	maxRawPendingRunes     = 4096
	maxConsecutiveSepRunes = MaxNormalizedDenylistRunes
)

// StreamGuard inspects incremental stream chunks over an immutable rolling holdback window,
// catching split denylist terms, Unicode/separator obfuscation, and built-in secret patterns
// with chunk-size-invariant interval-union redaction.
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

func (g *StreamGuard) resetOnAbort() {
	g.pending = nil
	g.aborted = true
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
	return g.drain(false)
}

// Flush validates and releases any remaining held-back tail at stream EOF.
func (g *StreamGuard) Flush() (string, error) {
	if g.aborted {
		return "", ErrPrivacyAborted
	}
	return g.drain(true)
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

func (g *StreamGuard) drain(isFlush bool) (string, error) {
	n := len(g.pending)
	if n == 0 {
		return "", nil
	}

	pendingStr := string(g.pending)
	var intervals []matchInterval

	// 1. Scan immutable pending buffer against always-on built-in secret patterns FIRST.
	for i, rule := range builtInSecretRules {
		if g.cfg.SecretAction == ActionAbort {
			if rule.regex.FindStringIndex(pendingStr) != nil {
				g.recordTrigger("builtin_secret", ActionAbort, rule.fingerprint)
				g.resetOnAbort()
				return "", ErrPrivacyAborted
			}
			continue
		}
		intervals = collectRegexMatches(intervals, rule.regex, pendingStr, "builtin_secret", rule.fingerprint, true, i)
	}

	// 2. Scan immutable pending buffer against configured runtime denylist rules.
	var normStr string
	var normMap []normRuneSpan
	normBuilt := false
	ensureNorm := func() {
		if !normBuilt {
			normStr, normMap = buildNormalizedMap(g.pending)
			normBuilt = true
		}
	}

	safeSecret := n
	if !isFlush {
		safeSecret = g.safeSecretBoundary()
	}

	var abortMatches []matchInterval
	for i, rule := range g.cfg.rules {
		if g.cfg.DenylistAction == ActionAbort {
			if rule.regex != nil {
				abortMatches = collectRegexMatches(abortMatches, rule.regex, pendingStr, "denylist", rule.fingerprint, false, i)
			} else if rule.normalized != "" {
				ensureNorm()
				abortMatches = collectLiteralMatches(abortMatches, rule, normStr, normMap, i)
			}
			continue
		}
		if rule.regex != nil {
			intervals = collectRegexMatches(intervals, rule.regex, pendingStr, "denylist", rule.fingerprint, false, i)
		} else if rule.normalized != "" {
			ensureNorm()
			intervals = collectLiteralMatches(intervals, rule, normStr, normMap, i)
		}
	}

	abortHold := n
	if len(abortMatches) > 0 {
		abortMatches = mergeOverlappingIntervals(abortMatches)
		for _, iv := range abortMatches {
			if isFlush || iv.end <= safeSecret {
				g.recordTrigger("denylist", ActionAbort, iv.fingerprint)
				g.resetOnAbort()
				return "", ErrPrivacyAborted
			}
			if iv.start < abortHold {
				abortHold = iv.start
			}
		}
	}

	// 3. Merge strictly overlapping intervals and enforce fail-closed overlap DoS bound.
	merged := mergeOverlappingIntervals(intervals)
	for _, iv := range merged {
		if iv.end-iv.start > maxRawPendingRunes {
			g.recordTrigger(iv.category, ActionAbort, iv.fingerprint)
			g.resetOnAbort()
			return "", ErrPrivacyAborted
		}
	}

	// 4. Compute exact safe flush horizon H.
	horizon := n
	if !isFlush {
		denylistHorizon := g.safeDenylistHorizon(normBuilt, normMap)
		horizon = min(safeSecret, denylistHorizon, abortHold)
		for _, iv := range merged {
			if iv.isSecret && iv.end >= n && iv.start < horizon {
				horizon = iv.start
			}
		}
		for horizon > 0 && horizon < n && isCombiningMark(g.pending[horizon]) {
			horizon--
		}
	}

	// 5. Emit safe text and committed redactions strictly up to H, holding any straddling interval.
	var out strings.Builder
	cursor := 0
	for _, iv := range merged {
		if iv.start >= horizon {
			break
		}
		if iv.end <= horizon {
			if iv.start > cursor {
				out.WriteString(string(g.pending[cursor:iv.start]))
			}
			g.recordTrigger(iv.category, ActionRedact, iv.fingerprint)
			out.WriteString(RedactionPlaceholder)
			cursor = iv.end
			continue
		}
		// Straddling interval (iv.start < horizon < iv.end): emit strictly safe prefix before
		// iv.start (preserving combining-mark clusters) and retain the interval in pending.
		holdStart := iv.start
		if holdStart > cursor && isCombiningMark(g.pending[holdStart]) {
			for holdStart > cursor && isCombiningMark(g.pending[holdStart]) {
				holdStart--
			}
		}
		if holdStart > cursor {
			out.WriteString(string(g.pending[cursor:holdStart]))
			cursor = holdStart
		}
		horizon = cursor
		break
	}
	if cursor < horizon {
		out.WriteString(string(g.pending[cursor:horizon]))
		cursor = horizon
	}

	if cursor >= n {
		g.pending = nil
	} else if cursor > 0 {
		g.pending = append([]rune(nil), g.pending[cursor:]...)
	}
	return out.String(), nil
}

func (g *StreamGuard) earliestActiveSecretAnchor() int {
	n := len(g.pending)
	earliest := n
	lowerRunes := make([]rune, n)
	for i, r := range g.pending {
		switch r {
		case '\u017F':
			lowerRunes[i] = 's'
		case '\u212A':
			lowerRunes[i] = 'k'
		default:
			lowerRunes[i] = unicode.ToLower(r)
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
			anchorStart := runePos
			if anchor == "://" {
				anchorStart = max(0, runePos-12)
			}
			if n-anchorStart <= MaxSecretHoldbackRunes && anchorStart < earliest {
				earliest = anchorStart
			}
			searchFrom = bytePos + len(anchor)
		}
	}
	return earliest
}

// safeSecretBoundary returns the earliest rune index that must remain held back for
// built-in secret detection (both <=16-rune partial anchor prefixes and active <=128-rune windows).
func (g *StreamGuard) safeSecretBoundary() int {
	n := len(g.pending)
	if n == 0 {
		return 0
	}
	boundary := min(max(0, n-BaselineSecretAnchorRunes), g.earliestActiveSecretAnchor())
	for boundary > 0 && boundary < n && isCombiningMark(g.pending[boundary]) {
		boundary--
	}
	return boundary
}

func (g *StreamGuard) safeDenylistHorizon(normBuilt bool, normMap []normRuneSpan) int {
	n := len(g.pending)
	limit := n
	if g.cfg.maxDenylistNonSep > 0 {
		spans := normMap
		if !normBuilt {
			_, spans = buildNormalizedMap(g.pending)
		}
		if len(spans) <= g.cfg.maxDenylistNonSep {
			return 0
		}
		limit = min(limit, spans[len(spans)-g.cfg.maxDenylistNonSep].rawStart)
	}
	if g.cfg.maxRegexRunes > 0 {
		rawLimit := n - g.cfg.maxRegexRunes
		if rawLimit <= 0 {
			return 0
		}
		limit = min(limit, rawLimit)
	}
	return limit
}
