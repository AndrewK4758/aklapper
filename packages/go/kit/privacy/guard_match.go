package privacy

import (
	"regexp"
	"sort"
	"strings"
	"unicode"
	"unicode/utf8"

	"golang.org/x/text/unicode/norm"
)

type normRuneSpan struct {
	rawStart int
	rawEnd   int
}

type matchInterval struct {
	start       int
	end         int
	category    string
	fingerprint string
	isSecret    bool
	ruleOrder   int
}

func isCombiningMark(r rune) bool {
	return unicode.Is(unicode.Mn, r) || unicode.Is(unicode.Mc, r) || unicode.Is(unicode.Me, r)
}

func buildNormalizedMap(raw []rune) (string, []normRuneSpan) {
	var b strings.Builder
	spans := make([]normRuneSpan, 0, len(raw))
	for i := 0; i < len(raw); {
		if isSeparatorRune(raw[i]) {
			i++
			continue
		}
		j := i + 1
		for j < len(raw) && isCombiningMark(raw[j]) {
			j++
		}
		expanded := norm.NFKC.String(string(raw[i:j]))
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

// collectRegexMatches enumerates all matches of a context-free regex over pendingStr,
// advancing by 1 rune past each match start so self-overlaps and cross-rule overlaps are
// captured completely and independently of chunk boundaries.
func collectRegexMatches(
	dst []matchInterval,
	re *regexp.Regexp,
	pendingStr string,
	category string,
	fingerprint string,
	isSecret bool,
	ruleOrder int,
) []matchInterval {
	searchByte := 0
	searchRune := 0
	for searchByte < len(pendingStr) {
		loc := re.FindStringIndex(pendingStr[searchByte:])
		if loc == nil {
			break
		}
		matchStartByte := searchByte + loc[0]
		matchEndByte := searchByte + loc[1]
		matchStartRune := searchRune + utf8.RuneCountInString(pendingStr[searchByte:matchStartByte])
		matchEndRune := matchStartRune + utf8.RuneCountInString(pendingStr[matchStartByte:matchEndByte])
		if matchEndRune > matchStartRune {
			dst = append(dst, matchInterval{
				start:       matchStartRune,
				end:         matchEndRune,
				category:    category,
				fingerprint: fingerprint,
				isSecret:    isSecret,
				ruleOrder:   ruleOrder,
			})
		}
		_, size := utf8.DecodeRuneInString(pendingStr[matchStartByte:])
		if size <= 0 {
			break
		}
		searchByte = matchStartByte + size
		searchRune = matchStartRune + 1
	}
	return dst
}

// collectLiteralMatches enumerates all occurrences of a normalized literal rule in normStr,
// stepping by 1 rune past each match start so self-overlapping literals merge cleanly.
func collectLiteralMatches(
	dst []matchInterval,
	rule denylistRule,
	normStr string,
	normMap []normRuneSpan,
	ruleOrder int,
) []matchInterval {
	searchByte := 0
	searchRune := 0
	for searchByte < len(normStr) {
		rel := strings.Index(normStr[searchByte:], rule.normalized)
		if rel < 0 {
			break
		}
		matchByte := searchByte + rel
		startNormRune := searchRune + utf8.RuneCountInString(normStr[searchByte:matchByte])
		endNormRune := startNormRune + rule.normLen
		if endNormRune > startNormRune && endNormRune <= len(normMap) {
			dst = append(dst, matchInterval{
				start:       normMap[startNormRune].rawStart,
				end:         normMap[endNormRune-1].rawEnd,
				category:    "denylist",
				fingerprint: rule.fingerprint,
				isSecret:    false,
				ruleOrder:   ruleOrder,
			})
		}
		_, size := utf8.DecodeRuneInString(normStr[matchByte:])
		if size <= 0 {
			break
		}
		searchByte = matchByte + size
		searchRune = startNormRune + 1
	}
	return dst
}

// mergeOverlappingIntervals sorts match intervals deterministically and merges strictly
// overlapping spans (next.start < cur.end). Adjacent spans (next.start == cur.end) remain distinct.
func mergeOverlappingIntervals(intervals []matchInterval) []matchInterval {
	if len(intervals) <= 1 {
		return intervals
	}
	sort.Slice(intervals, func(i, j int) bool {
		a, b := intervals[i], intervals[j]
		if a.start != b.start {
			return a.start < b.start
		}
		if a.isSecret != b.isSecret {
			return a.isSecret
		}
		if a.ruleOrder != b.ruleOrder {
			return a.ruleOrder < b.ruleOrder
		}
		return a.end > b.end
	})

	merged := make([]matchInterval, 0, len(intervals))
	for _, iv := range intervals {
		if len(merged) == 0 || iv.start >= merged[len(merged)-1].end {
			merged = append(merged, iv)
			continue
		}
		last := &merged[len(merged)-1]
		if iv.end > last.end {
			last.end = iv.end
		}
		if iv.isSecret && !last.isSecret {
			last.isSecret = true
			last.category = iv.category
			last.fingerprint = iv.fingerprint
			last.ruleOrder = iv.ruleOrder
		} else if iv.isSecret == last.isSecret && iv.ruleOrder < last.ruleOrder {
			last.category = iv.category
			last.fingerprint = iv.fingerprint
			last.ruleOrder = iv.ruleOrder
		}
	}
	return merged
}
