package privacy

import (
	"strings"
	"unicode"

	"golang.org/x/text/unicode/norm"
)

func isCleanASCII(s string) bool {
	for i := 0; i < len(s); i++ {
		if s[i] == 0 || s[i] >= 0x80 {
			return false
		}
	}
	return true
}

func hasASCIIDigit(s string) bool {
	for i := 0; i < len(s); i++ {
		if s[i] >= '0' && s[i] <= '9' {
			return true
		}
	}
	return false
}

func hasASCIIDigitOrUpper(s string) bool {
	for i := 0; i < len(s); i++ {
		if (s[i] >= 'A' && s[i] <= 'Z') || (s[i] >= '0' && s[i] <= '9') {
			return true
		}
	}
	return false
}

func containsASCIIFold(s, lowerNeedle string) bool {
	nLen := len(lowerNeedle)
	if nLen == 0 || len(s) < nLen {
		return false
	}
	first := lowerNeedle[0]
	firstUpper := first
	if first >= 'a' && first <= 'z' {
		firstUpper = first - 32
	}
	limit := len(s) - nLen
	for i := 0; i <= limit; i++ {
		if s[i] != first && s[i] != firstUpper {
			continue
		}
		matched := true
		for j := 1; j < nLen; j++ {
			b := s[i+j]
			if b >= 'A' && b <= 'Z' {
				b += 32
			}
			if b != lowerNeedle[j] {
				matched = false
				break
			}
		}
		if matched {
			return true
		}
	}
	return false
}

// StripInvisibleAndNormalize applies NFKC normalization and strips NUL and invisible Unicode format (Cf) runes.
func StripInvisibleAndNormalize(raw string) string {
	if isCleanASCII(raw) {
		return raw
	}
	nfkc := norm.NFKC.String(raw)
	var b strings.Builder
	b.Grow(len(nfkc))
	for _, r := range nfkc {
		if r == 0 || unicode.Is(unicode.Cf, r) {
			continue
		}
		b.WriteRune(r)
	}
	return b.String()
}

// FoldDiacriticsAndInvisible decomposes via NFKD, strips NUL, invisible format (Cf), and
// non-spacing combining mark (Mn) runes, and recomposes canonical NFKC (preserving
// Hangul syllables and Indic clusters) for whole-document and storage confidentiality gates.
func FoldDiacriticsAndInvisible(raw string) string {
	if isCleanASCII(raw) {
		return raw
	}
	nfkd := norm.NFKD.String(raw)
	var b strings.Builder
	b.Grow(len(nfkd))
	for _, r := range nfkd {
		if r == 0 || unicode.Is(unicode.Cf, r) || unicode.Is(unicode.Mn, r) {
			continue
		}
		b.WriteRune(r)
	}
	return norm.NFKC.String(b.String())
}

// NormalizePrivacyTerm applies NFKC normalization, strips invisible format characters,
// collapses internal whitespace to single spaces, and lowercases.
func NormalizePrivacyTerm(raw string) string {
	cleaned := StripInvisibleAndNormalize(raw)
	fields := strings.Fields(cleaned)
	if len(fields) == 0 {
		return ""
	}
	return strings.ToLower(strings.Join(fields, " "))
}

// CollapseForSeparatorMatch folds diacritics and strips all non-ASCII-alphanumeric runes.
func CollapseForSeparatorMatch(raw string) string {
	folded := strings.ToLower(FoldDiacriticsAndInvisible(raw))
	var b strings.Builder
	b.Grow(len(folded))
	for _, r := range folded {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			b.WriteRune(r)
		}
	}
	return b.String()
}
