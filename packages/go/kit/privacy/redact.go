package privacy

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"regexp"
	"strings"
	"unicode"
	"unicode/utf8"
)

const DefaultStorageMaxRunes = 1000

var storageExtraRedactPatterns = []*regexp.Regexp{
	regexp.MustCompile(`\b(?:AKIA|ASIA|AIDA|AROA|AIPA|ANPA|ANVA)[0-9A-Z]{16}\b`),
	regexp.MustCompile(`\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b`),
	regexp.MustCompile(`\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}\b`),
	regexp.MustCompile(`\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b`),
	regexp.MustCompile(`\bxox[baprs]-[A-Za-z0-9-]{10,}\b`),
	regexp.MustCompile(`\b\d{3}-\d{2}-\d{4}\b`),
	regexp.MustCompile(`(?i)(?:~|/home/[A-Za-z0-9._-]+|/Users/[A-Za-z0-9._-]+)/projects/[A-Za-z0-9._/-]+`),
	regexp.MustCompile(`(?i)\baklapper[-_/]cadence\b`),
	regexp.MustCompile(`(?i)\b(?:AKL|DEC|II|PROD|OQ)-\d+\b`),
}

var storageTrackerKeyRe = regexp.MustCompile(`\b([A-Z]{2,8})-(\d{1,8})\b`)

func mapByteSpanToRawRunes(viewStr string, startByte, endByte int, spans []normRuneSpan) (int, int, bool) {
	startRune := utf8.RuneCountInString(viewStr[:startByte])
	endRune := startRune + utf8.RuneCountInString(viewStr[startByte:endByte])
	if spans != nil {
		if startRune < 0 || endRune <= startRune || endRune > len(spans) {
			return 0, 0, false
		}
		startRune = spans[startRune].rawStart
		endRune = spans[endRune-1].rawEnd
	}
	return startRune, endRune, true
}

func collectByteSpanMatches(
	dst []matchInterval,
	byteSpans [][2]int,
	viewStr string,
	spans []normRuneSpan,
	category string,
	fingerprint string,
	ruleOrder int,
) []matchInterval {
	for _, loc := range byteSpans {
		startRune, endRune, ok := mapByteSpanToRawRunes(viewStr, loc[0], loc[1], spans)
		if !ok {
			continue
		}
		dst = append(dst, matchInterval{
			start:       startRune,
			end:         endRune,
			category:    category,
			fingerprint: fingerprint,
			isSecret:    true,
			ruleOrder:   ruleOrder,
		})
	}
	return dst
}

func isHangulSyllableStart(r rune) bool {
	return (r >= 0x1100 && r <= 0x115F) || (r >= 0xAC00 && r <= 0xD7A3)
}

func isHangulContinuation(r rune) bool {
	return r >= 0x1160 && r <= 0x11FF
}

func buildFoldedSpanView(raw []rune) (string, []normRuneSpan, bool) {
	var b strings.Builder
	b.Grow(len(raw))
	spans := make([]normRuneSpan, 0, len(raw))
	for i := 0; i < len(raw); {
		j := i + 1
		combCount := 0
		if isCombiningMark(raw[i]) {
			combCount = 1
		}
		hangulSyllable := isHangulSyllableStart(raw[i])
		for j < len(raw) {
			if isCombiningMark(raw[j]) {
				combCount++
				if combCount > maxRawPendingRunes {
					return "", nil, true
				}
				j++
				continue
			}
			if hangulSyllable && isHangulContinuation(raw[j]) {
				j++
				continue
			}
			break
		}
		foldedCluster := FoldDiacriticsAndInvisible(string(raw[i:j]))
		for _, nr := range foldedCluster {
			b.WriteRune(nr)
			spans = append(spans, normRuneSpan{rawStart: i, rawEnd: j})
		}
		i = j
	}
	return b.String(), spans, false
}

func buildFoldedNormFromView(foldedStr string, foldedSpans []normRuneSpan) (string, []normRuneSpan) {
	var b strings.Builder
	b.Grow(len(foldedStr))
	outSpans := make([]normRuneSpan, 0, len(foldedSpans))
	idx := 0
	for _, r := range foldedStr {
		sp := foldedSpans[idx]
		idx++
		if isSeparatorRune(r) {
			continue
		}
		b.WriteRune(unicode.ToLower(r))
		outSpans = append(outSpans, sp)
	}
	return b.String(), outSpans
}

func collectMappedRegexMatches(
	dst []matchInterval,
	re *regexp.Regexp,
	viewStr string,
	spans []normRuneSpan,
	category string,
	fingerprint string,
	isSecret bool,
	ruleOrder int,
) []matchInterval {
	found := collectRegexMatches(nil, re, viewStr, category, fingerprint, isSecret, ruleOrder)
	for _, m := range found {
		if spans != nil {
			if m.start < 0 || m.end <= m.start || m.end > len(spans) {
				continue
			}
			m.start = spans[m.start].rawStart
			m.end = spans[m.end-1].rawEnd
		}
		dst = append(dst, m)
	}
	return dst
}

func collectTrackerMatches(
	dst []matchInterval,
	viewStr string,
	spans []normRuneSpan,
	ruleOrder int,
) []matchInterval {
	for _, loc := range storageTrackerKeyRe.FindAllStringSubmatchIndex(viewStr, -1) {
		if len(loc) < 4 {
			continue
		}
		if _, allowed := AllowedTechPrefixes[viewStr[loc[2]:loc[3]]]; allowed {
			continue
		}
		startRune, endRune, ok := mapByteSpanToRawRunes(viewStr, loc[0], loc[1], spans)
		if !ok {
			continue
		}
		dst = append(dst, matchInterval{
			start:       startRune,
			end:         endRune,
			category:    "tracker",
			fingerprint: "storage_tracker",
			isSecret:    false,
			ruleOrder:   ruleOrder,
		})
	}
	return dst
}

func parseDossierDenylistEnv(raw string) ([]string, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return nil, nil
	}
	payload := trimmed
	if !strings.HasPrefix(payload, "[") {
		compact := strings.Join(strings.Fields(trimmed), "")
		decoded, err := base64.StdEncoding.DecodeString(compact)
		if err != nil {
			decoded, err = base64.RawStdEncoding.DecodeString(strings.TrimRight(compact, "="))
		}
		if err != nil {
			return nil, errors.New("invalid base64 encoding in DOSSIER_PRIVACY_DENYLIST")
		}
		payload = strings.TrimSpace(string(decoded))
	}
	var list []string
	if err := json.Unmarshal([]byte(payload), &list); err != nil || list == nil {
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
// and PII from visitor prompt text in a single interval-union pass over the immutable pre-redaction
// rune slice before persisting to ask_turns.prompt_text, capped at maxRunes.
func RedactTextForStorage(cfg *Config, raw string, maxRunes int) string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return ""
	}
	if maxRunes <= 0 {
		maxRunes = DefaultStorageMaxRunes
	}

	normalized := strings.TrimSpace(StripInvisibleAndNormalize(trimmed))
	if normalized == "" {
		return ""
	}
	rawRunes := []rune(normalized)

	if cfg != nil && cfg.maxDenylistNonSep > 0 {
		sepRun := 0
		for _, r := range rawRunes {
			if isNormalizedSeparator(r) {
				sepRun++
				if sepRun > maxRawPendingRunes {
					return RedactionPlaceholder
				}
			} else {
				sepRun = 0
			}
		}
	}

	foldedStr, foldedSpans, flood := buildFoldedSpanView(rawRunes)
	if flood {
		return RedactionPlaceholder
	}

	var intervals []matchInterval
	order := 0
	for _, rule := range builtInSecretRules {
		intervals = collectMappedRegexMatches(intervals, rule.regex, normalized, nil, "builtin_secret", rule.fingerprint, true, order)
		intervals = collectMappedRegexMatches(intervals, rule.regex, foldedStr, foldedSpans, "builtin_secret", rule.fingerprint, true, order)
		order++
	}

	if cfg != nil && len(cfg.rules) > 0 {
		rawNormStr, rawNormMap := buildNormalizedMap(rawRunes)
		foldedNormStr, foldedNormMap := buildFoldedNormFromView(foldedStr, foldedSpans)
		for _, rule := range cfg.rules {
			if rule.regex != nil {
				intervals = collectMappedRegexMatches(intervals, rule.regex, normalized, nil, "denylist", rule.fingerprint, false, order)
				intervals = collectMappedRegexMatches(intervals, rule.regex, foldedStr, foldedSpans, "denylist", rule.fingerprint, false, order)
			} else if rule.normalized != "" {
				intervals = collectLiteralMatches(intervals, rule, rawNormStr, rawNormMap, order)
				foldedKey := normalizeDenylistKey(FoldDiacriticsAndInvisible(rule.normalized))
				if foldedLen := utf8.RuneCountInString(foldedKey); foldedLen > 0 {
					foldedRule := denylistRule{
						normalized:  foldedKey,
						normLen:     foldedLen,
						fingerprint: rule.fingerprint,
					}
					intervals = collectLiteralMatches(intervals, foldedRule, foldedNormStr, foldedNormMap, order)
				}
			}
			order++
		}
	}

	for _, re := range storageExtraRedactPatterns {
		intervals = collectMappedRegexMatches(intervals, re, normalized, nil, "storage_secret", "storage_extra", true, order)
		intervals = collectMappedRegexMatches(intervals, re, foldedStr, foldedSpans, "storage_secret", "storage_extra", true, order)
		order++
	}
	intervals = collectByteSpanMatches(intervals, FindEmailSpans(normalized), normalized, nil, "storage_pii", "email", order)
	intervals = collectByteSpanMatches(intervals, FindEmailSpans(foldedStr), foldedStr, foldedSpans, "storage_pii", "email", order)
	order++
	intervals = collectByteSpanMatches(intervals, FindUSPhoneSpans(normalized), normalized, nil, "storage_pii", "us_phone", order)
	intervals = collectByteSpanMatches(intervals, FindUSPhoneSpans(foldedStr), foldedStr, foldedSpans, "storage_pii", "us_phone", order)
	order++
	intervals = collectTrackerMatches(intervals, normalized, nil, order)
	intervals = collectTrackerMatches(intervals, foldedStr, foldedSpans, order)

	cleaned := normalized
	if len(intervals) > 0 {
		merged := mergeOverlappingIntervals(intervals)
		var out strings.Builder
		cursor := 0
		for _, iv := range merged {
			if iv.start > cursor {
				out.WriteString(string(rawRunes[cursor:iv.start]))
			}
			out.WriteString(RedactionPlaceholder)
			cursor = iv.end
		}
		if cursor < len(rawRunes) {
			out.WriteString(string(rawRunes[cursor:]))
		}
		cleaned = strings.TrimSpace(out.String())
	}

	runes := []rune(cleaned)
	if len(runes) > maxRunes {
		return string(runes[:maxRunes])
	}
	return cleaned
}
