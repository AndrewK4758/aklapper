package privacy

import (
	"strings"
	"unicode"
	"unicode/utf8"

	"golang.org/x/text/unicode/norm"
)

type guardRune struct {
	r        rune
	redacted bool
}

type runeSegment struct {
	start int
	end   int
}

type normRuneSpan struct {
	rawStart int
	rawEnd   int
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

// isWordRune matches Go RE2's ASCII word-character class ([0-9A-Za-z_]) used by \b and \B.
func isWordRune(r rune) bool {
	return (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '_'
}

func unredactedSegments(items []guardRune, limit int) []runeSegment {
	if limit > len(items) {
		limit = len(items)
	}
	var segs []runeSegment
	i := 0
	for i < limit {
		if items[i].redacted {
			i++
			continue
		}
		start := i
		for i < limit && !items[i].redacted {
			i++
		}
		segs = append(segs, runeSegment{start: start, end: i})
	}
	return segs
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

// matchDenylistRule finds the leftmost match of rule within segStr/normStr, translating
// indices back to pending rune offsets. When hasPrefix is true, regex rules scan a 1-rune
// read-only prefix via prefixRegex so \b, \B, ^, and \A observe the real preceding rune.
func matchDenylistRule(
	rule denylistRule,
	segStart int,
	segStr string,
	normStr string,
	normMap []normRuneSpan,
	hasPrefix bool,
	prefixRune rune,
) (int, int, bool) {
	if rule.regex != nil {
		if hasPrefix && rule.prefixRegex != nil {
			prefix := string(prefixRune)
			combined := prefix + segStr
			loc := rule.prefixRegex.FindStringSubmatchIndex(combined)
			if loc != nil && len(loc) >= 4 && loc[2] >= len(prefix) && loc[3] > loc[2] {
				relStart := loc[2] - len(prefix)
				relEnd := loc[3] - len(prefix)
				startRune := segStart + utf8.RuneCountInString(segStr[:relStart])
				endRune := startRune + utf8.RuneCountInString(segStr[relStart:relEnd])
				return startRune, endRune, true
			}
			return 0, 0, false
		}
		if loc := rule.regex.FindStringIndex(segStr); loc != nil && loc[1] > loc[0] {
			startRune := segStart + utf8.RuneCountInString(segStr[:loc[0]])
			endRune := startRune + utf8.RuneCountInString(segStr[loc[0]:loc[1]])
			return startRune, endRune, true
		}
		return 0, 0, false
	}

	if rule.normalized != "" {
		if idx := strings.Index(normStr, rule.normalized); idx >= 0 {
			startNormRune := utf8.RuneCountInString(normStr[:idx])
			endNormRune := startNormRune + utf8.RuneCountInString(rule.normalized)
			if endNormRune > startNormRune && endNormRune <= len(normMap) {
				startRune := segStart + normMap[startNormRune].rawStart
				endRune := segStart + normMap[endNormRune-1].rawEnd
				return startRune, endRune, true
			}
		}
	}
	return 0, 0, false
}
