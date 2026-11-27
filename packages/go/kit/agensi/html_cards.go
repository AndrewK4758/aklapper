package agensi

import (
	"net/url"
	"regexp"
	"strconv"
	"strings"
)

const MaxSemanticCards = 200

type scannedElement struct {
	openTag string
	body    string
}

var (
	htmlEntityRE = regexp.MustCompile(`&(?:([a-zA-Z]+)|#([0-9]{1,8})|#x([0-9a-fA-F]{1,8}));`)
	byPrefixRE   = regexp.MustCompile(`(?i)^by\s+`)
	whitespaceRE = regexp.MustCompile(`\s+`)
)

func decodeHTMLEntities(input string) string {
	return htmlEntityRE.ReplaceAllStringFunc(input, func(match string) string {
		sub := htmlEntityRE.FindStringSubmatch(match)
		if len(sub) < 4 {
			return match
		}
		if sub[1] != "" {
			switch strings.ToLower(sub[1]) {
			case "amp":
				return "&"
			case "lt":
				return "<"
			case "gt":
				return ">"
			case "quot":
				return `"`
			case "apos":
				return "'"
			default:
				return match
			}
		}
		var cp int64
		var err error
		if sub[2] != "" {
			cp, err = strconv.ParseInt(sub[2], 10, 32)
		} else if sub[3] != "" {
			cp, err = strconv.ParseInt(sub[3], 16, 32)
		}
		if err != nil || cp < 0 || cp > 0x10ffff {
			return ""
		}
		return string(rune(cp))
	})
}

func stripTagsLinear(rawHTML string) string {
	var b strings.Builder
	b.Grow(len(rawHTML))
	inTag := false
	for i := 0; i < len(rawHTML); i++ {
		ch := rawHTML[i]
		if ch == '<' {
			inTag = true
		} else if ch == '>' {
			inTag = false
		} else if !inTag {
			b.WriteByte(ch)
		}
	}
	return strings.TrimSpace(whitespaceRE.ReplaceAllString(decodeHTMLEntities(b.String()), " "))
}

func asciiToLower(s string) string {
	var b strings.Builder
	for i := 0; i < len(s); i++ {
		ch := s[i]
		if ch >= 'A' && ch <= 'Z' {
			if b.Len() == 0 {
				b.Grow(len(s))
				b.WriteString(s[:i])
			}
			b.WriteByte(ch + ('a' - 'A'))
		} else if b.Len() > 0 {
			b.WriteByte(ch)
		}
	}
	if b.Len() == 0 {
		return s
	}
	return b.String()
}

func scanTagBlocksLinear(html, lowerHTML, tagName string) []scannedElement {
	results := make([]scannedElement, 0)
	openPrefix := "<" + tagName
	closeToken := "</" + tagName + ">"
	cursor := 0
	for cursor < len(lowerHTML) {
		rel := strings.Index(lowerHTML[cursor:], openPrefix)
		if rel < 0 {
			break
		}
		start := cursor + rel
		afterIdx := start + len(openPrefix)
		if afterIdx < len(lowerHTML) {
			ch := lowerHTML[afterIdx]
			if ch != '>' && ch != ' ' && ch != '\t' && ch != '\n' && ch != '\r' && ch != '/' {
				cursor = afterIdx
				continue
			}
		}
		openEndRel := strings.IndexByte(lowerHTML[afterIdx:], '>')
		if openEndRel < 0 {
			break
		}
		openEnd := afterIdx + openEndRel
		closeRel := strings.Index(lowerHTML[openEnd+1:], closeToken)
		if closeRel < 0 {
			break
		}
		closeStart := openEnd + 1 + closeRel
		if start >= 0 && openEnd >= start && closeStart >= openEnd+1 && closeStart <= len(html) {
			results = append(results, scannedElement{
				openTag: html[start : openEnd+1],
				body:    html[openEnd+1 : closeStart],
			})
		}
		cursor = closeStart + len(closeToken)
	}
	return results
}

func extractSkillSlugFromSlice(slice string) string {
	lower := asciiToLower(slice)
	for _, marker := range []string{`href="/skills/`, `href='/skills/`} {
		idx := strings.Index(lower, marker)
		if idx < 0 {
			continue
		}
		quote := marker[5]
		valStart := idx + len(marker)
		if valStart > len(slice) {
			continue
		}
		valEndRel := strings.IndexByte(slice[valStart:], quote)
		if valEndRel < 0 {
			continue
		}
		raw := slice[valStart : valStart+valEndRel]
		if cut := strings.IndexAny(raw, "/?#"); cut >= 0 {
			raw = raw[:cut]
		}
		if trimmed := strings.TrimSpace(raw); trimmed != "" {
			return trimmed
		}
	}
	return ""
}

func extractCardFromContainer(slug, body string, seen map[string]struct{}, sortOrder int) map[string]any {
	if slug == "" {
		return nil
	}
	if _, dup := seen[slug]; dup {
		return nil
	}
	lowerBody := asciiToLower(body)
	h3Blocks := scanTagBlocksLinear(body, lowerBody, "h3")
	pBlocks := scanTagBlocksLinear(body, lowerBody, "p")
	if len(h3Blocks) == 0 {
		return nil
	}
	name := stripTagsLinear(h3Blocks[0].body)
	if name == "" {
		return nil
	}
	summary := ""
	for _, pb := range pBlocks {
		cand := stripTagsLinear(pb.body)
		if cand != "" && !byPrefixRE.MatchString(cand) {
			summary = cand
			break
		}
	}
	if summary == "" {
		return nil
	}
	seen[slug] = struct{}{}
	return map[string]any{
		"slug":      slug,
		"name":      name,
		"summary":   summary,
		"tags":      []any{},
		"url":       CanonicalSkillOrigin + url.PathEscape(slug),
		"status":    "live",
		"sortOrder": sortOrder,
	}
}

func extractSemanticHTMLFallback(html, lowerHTML, creatorHandle, finalURL string) []map[string]any {
	parsed, err := url.Parse(finalURL)
	if err != nil {
		return nil
	}
	normPath := strings.ToLower(strings.TrimRight(parsed.Path, "/"))
	rawExp := "/creators/" + strings.ToLower(strings.TrimSpace(creatorHandle))
	encExp := "/creators/" + strings.ToLower(url.PathEscape(strings.TrimSpace(creatorHandle)))
	if normPath != rawExp && normPath != encExp {
		return nil
	}

	items := make([]map[string]any, 0)
	seen := make(map[string]struct{})
	for _, art := range scanTagBlocksLinear(html, lowerHTML, "article") {
		if len(items) >= MaxSemanticCards {
			break
		}
		slug := extractSkillSlugFromSlice(art.body)
		if card := extractCardFromContainer(slug, art.body, seen, len(items)+1); card != nil {
			items = append(items, card)
		}
	}
	if len(items) == 0 {
		for _, anc := range scanTagBlocksLinear(html, lowerHTML, "a") {
			if len(items) >= MaxSemanticCards {
				break
			}
			slug := extractSkillSlugFromSlice(anc.openTag)
			if card := extractCardFromContainer(slug, anc.body, seen, len(items)+1); card != nil {
				items = append(items, card)
			}
		}
	}
	return items
}
