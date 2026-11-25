package privacy

import (
	"strings"
	"unicode"
	"unicode/utf8"
)

const (
	maxRawPendingRunes     = 4096
	maxConsecutiveSepRunes = 64
	maxWordSnapBackRunes   = 64
	rawSecretTailRunes     = MaxSecretHoldbackRunes + 256
)

// StreamGuard inspects incremental stream chunks with a rolling holdback window,
// catching split denylist terms, Unicode/separator obfuscation, and built-in secret patterns.
type StreamGuard struct {
	cfg               *Config
	correlationID     string
	pending           []guardRune
	rawSecretBuf      []rune
	prevFlushedRune   rune
	hasPrevFlushed    bool
	deferredHoldIndex int
	aborted           bool
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
	g.rawSecretBuf = nil
	g.prevFlushedRune = 0
	g.hasPrevFlushed = false
	g.deferredHoldIndex = 0
	g.aborted = true
}

// Process ingests the next incremental chunk and returns only text proven safe to emit.
func (g *StreamGuard) Process(chunk string) (string, error) {
	if g.aborted {
		return "", ErrPrivacyAborted
	}
	if chunk != "" {
		chunkRunes := []rune(chunk)
		g.rawSecretBuf = append(g.rawSecretBuf, chunkRunes...)
		for _, r := range chunkRunes {
			g.pending = append(g.pending, guardRune{r: r})
		}
		g.collapseExtremeSeparators()
	}
	if err := g.applyRules(false); err != nil {
		return "", err
	}
	if len(g.rawSecretBuf) > rawSecretTailRunes {
		g.rawSecretBuf = append([]rune(nil), g.rawSecretBuf[len(g.rawSecretBuf)-rawSecretTailRunes:]...)
	}
	flushEnd := g.safeFlushIndex()
	if flushEnd <= 0 {
		return "", nil
	}
	safe := pendingToString(g.pending[:flushEnd])
	g.prevFlushedRune = g.pending[flushEnd-1].r
	g.hasPrevFlushed = true
	g.pending = append([]guardRune(nil), g.pending[flushEnd:]...)
	return safe, nil
}

// Flush validates and releases any remaining held-back tail at stream EOF.
func (g *StreamGuard) Flush() (string, error) {
	if g.aborted {
		return "", ErrPrivacyAborted
	}
	if err := g.applyRules(true); err != nil {
		return "", err
	}
	if len(g.pending) == 0 {
		g.rawSecretBuf = nil
		return "", nil
	}
	out := pendingToString(g.pending)
	g.prevFlushedRune = g.pending[len(g.pending)-1].r
	g.hasPrevFlushed = true
	g.pending = nil
	g.rawSecretBuf = nil
	g.deferredHoldIndex = 0
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

func (g *StreamGuard) segmentPrefixContext(segStart int) (bool, rune) {
	if segStart > 0 {
		return true, g.pending[segStart-1].r
	}
	if g.hasPrevFlushed {
		return true, g.prevFlushedRune
	}
	return false, 0
}

func (g *StreamGuard) applyRules(isFlush bool) error {
	// 1a. For default fail-closed ActionAbort, scan the unmutated raw secret buffer FIRST so
	// denylist ActionRedact can never split or blind a built-in credential/JWT/PEM secret.
	if g.cfg.SecretAction == ActionAbort && len(g.rawSecretBuf) > 0 {
		rawStr := string(g.rawSecretBuf)
		for _, rule := range builtInSecretRules {
			if rule.regex.FindStringIndex(rawStr) != nil {
				g.recordTrigger("builtin_secret", ActionAbort, rule.fingerprint)
				g.resetOnAbort()
				return ErrPrivacyAborted
			}
		}
	}

	maxIter := len(g.pending) + 64
	for iter := 0; iter < maxIter; iter++ {
		g.deferredHoldIndex = len(g.pending)

		// 1b. Always-on built-in secret patterns over unredacted segments (handles ActionRedact too).
		allSegs := unredactedSegments(g.pending, len(g.pending))
		if len(allSegs) == 0 {
			return nil
		}
		matchedSecret := false
		for _, seg := range allSegs {
			segStr := pendingToString(g.pending[seg.start:seg.end])
			for _, rule := range builtInSecretRules {
				loc := rule.regex.FindStringIndex(segStr)
				if loc == nil {
					continue
				}
				g.recordTrigger("builtin_secret", g.cfg.SecretAction, rule.fingerprint)
				if g.cfg.SecretAction == ActionAbort {
					g.resetOnAbort()
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

		// 2. Configured runtime denylist (deferred past safeSecretBoundary during streaming so
		// neither trailing <=16-rune partial secret-anchor prefixes nor active 128-rune secret
		// windows are mutated, and matches wait until endRune <= commitLimit and no overlapping
		// higher-priority rule is deferred).
		if len(g.cfg.rules) == 0 {
			return nil
		}
		denylistLimit := len(g.pending)
		commitLimit := denylistLimit
		if !isFlush {
			denylistLimit = g.safeSecretBoundary()
			commitLimit = g.safeDenylistCommitIndex(denylistLimit)
			if commitLimit <= 0 {
				return nil
			}
		}
		denylistSegs := unredactedSegments(g.pending, denylistLimit)
		if len(denylistSegs) == 0 {
			return nil
		}
		matchedDenylist := false
		for _, seg := range denylistSegs {
			if !isFlush && seg.start >= commitLimit {
				break
			}
			segSlice := g.pending[seg.start:seg.end]
			segStr := pendingToString(segSlice)
			normStr, normMap := buildNormalizedMap(segSlice)
			hasPrefix, prefixRune := g.segmentPrefixContext(seg.start)
			deferredStart := seg.end
			for _, rule := range g.cfg.rules {
				startRune, endRune, found := matchDenylistRule(
					rule, seg.start, segStr, normStr, normMap, hasPrefix, prefixRune,
				)
				if !found {
					continue
				}
				if !isFlush && (endRune > commitLimit || endRune >= denylistLimit || endRune > deferredStart) {
					if startRune < deferredStart {
						deferredStart = startRune
					}
					if startRune < g.deferredHoldIndex {
						g.deferredHoldIndex = startRune
					}
					continue
				}
				g.recordTrigger("denylist", g.cfg.DenylistAction, rule.fingerprint)
				if g.cfg.DenylistAction == ActionAbort {
					g.resetOnAbort()
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
	g.resetOnAbort()
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

func (g *StreamGuard) earliestActiveSecretAnchor() int {
	n := len(g.pending)
	earliest := n
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
			if n-runePos <= MaxSecretHoldbackRunes && runePos < earliest {
				earliest = runePos
			}
			searchFrom = bytePos + len(anchor)
		}
	}
	return earliest
}

// safeSecretBoundary is the unified streaming deferral boundary shared by applyRules(false)
// and safeFlushIndex(). Every secretAnchorPrefixes entry has length <= 14 <= BaselineSecretAnchorRunes.
func (g *StreamGuard) safeSecretBoundary() int {
	n := len(g.pending)
	if n == 0 {
		return 0
	}
	boundary := min(max(0, n-BaselineSecretAnchorRunes), g.earliestActiveSecretAnchor())
	for boundary > 0 && boundary < n && !g.pending[boundary].redacted && isCombiningMark(g.pending[boundary].r) {
		boundary--
	}
	return boundary
}

func (g *StreamGuard) safeDenylistCommitIndex(scanLimit int) int {
	if scanLimit <= 0 {
		return 0
	}
	limit := scanLimit
	if g.cfg.maxDenylistNonSep > 0 {
		_, spans := buildNormalizedMap(g.pending[:scanLimit])
		if len(spans) <= g.cfg.maxDenylistNonSep {
			return 0
		}
		limit = min(limit, spans[len(spans)-g.cfg.maxDenylistNonSep].rawStart)
	}
	if g.cfg.maxRegexRunes > 0 {
		rawLimit := scanLimit - g.cfg.maxRegexRunes
		if rawLimit <= 0 {
			return 0
		}
		limit = min(limit, rawLimit)
	}
	return limit
}

func (g *StreamGuard) safeFlushIndex() int {
	n := len(g.pending)
	if n == 0 {
		return 0
	}
	safeSecret := g.safeSecretBoundary()
	if safeSecret <= 0 {
		return 0
	}
	flushEnd := min(safeSecret, g.safeDenylistCommitIndex(safeSecret))
	if g.deferredHoldIndex < flushEnd {
		flushEnd = g.deferredHoldIndex
	}
	for flushEnd > 0 && flushEnd < n && !g.pending[flushEnd].redacted && isCombiningMark(g.pending[flushEnd].r) {
		flushEnd--
	}
	if flushEnd > 0 && flushEnd < n &&
		!g.pending[flushEnd-1].redacted && !g.pending[flushEnd].redacted &&
		isWordRune(g.pending[flushEnd-1].r) && isWordRune(g.pending[flushEnd].r) {
		snapped := flushEnd
		for snapped > 0 && flushEnd-snapped < maxWordSnapBackRunes &&
			!g.pending[snapped-1].redacted && isWordRune(g.pending[snapped-1].r) {
			snapped--
		}
		if flushEnd-snapped < maxWordSnapBackRunes {
			flushEnd = snapped
		}
	}
	return flushEnd
}
