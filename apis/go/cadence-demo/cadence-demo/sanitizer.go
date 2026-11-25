package main

import (
	"regexp"
	"strings"
	"unicode/utf8"
)

var markdownFenceRe = regexp.MustCompile("(?is)^\\s*```(?:html)?\\s*\\n?(.*?)\\s*```\\s*$")

func scanRawOrRcdataEnd(src string, bodyStart int, tagName string) (string, int, bool) {
	needle := "</" + tagName
	for p := bodyStart; p < len(src); p++ {
		if hasPrefixIgnoreCase(src, p, needle) && isEndTagBoundary(src, p+len(needle)) {
			closeTag := parseTag(src, p, true)
			return src[bodyStart:p], closeTag.endIndex, closeTag.closed
		}
	}
	return src[bodyStart:], len(src), false
}

func scanScriptBodyEnd(src string, bodyStart int) (string, int, bool) {
	escaped, doubleEscaped := false, false
	for p := bodyStart; p < len(src); {
		if !escaped {
			if strings.HasPrefix(src[p:], "<!--") {
				escaped = true
				p += 2
				continue
			}
			if hasPrefixIgnoreCase(src, p, "</script") && isEndTagBoundary(src, p+8) {
				closeTag := parseTag(src, p, true)
				return src[bodyStart:p], closeTag.endIndex, closeTag.closed
			}
		} else if strings.HasPrefix(src[p:], "-->") {
			escaped, doubleEscaped = false, false
			p += 3
			continue
		} else if !doubleEscaped {
			if hasPrefixIgnoreCase(src, p, "<script") && isEndTagBoundary(src, p+7) {
				doubleEscaped = true
				p += 7
				continue
			}
			if hasPrefixIgnoreCase(src, p, "</script") && isEndTagBoundary(src, p+8) {
				closeTag := parseTag(src, p, true)
				return src[bodyStart:p], closeTag.endIndex, closeTag.closed
			}
		} else if hasPrefixIgnoreCase(src, p, "</script") && isEndTagBoundary(src, p+8) {
			doubleEscaped = false
			p += 8
			continue
		}
		p++
	}
	return src[bodyStart:], len(src), false
}

func findCommentEnd(src string, start int) int {
	if strings.HasPrefix(src[start:], "<!-->") {
		return start + 5
	}
	if strings.HasPrefix(src[start:], "<!--->") {
		return start + 6
	}
	for p := start + 4; p < len(src); p++ {
		if strings.HasPrefix(src[p:], "-->") {
			return p + 3
		}
		if strings.HasPrefix(src[p:], "--!>") {
			return p + 4
		}
	}
	return len(src)
}

func skipNestableContainer(src string, bodyStart int, tagName string) int {
	openNeedle, closeNeedle := "<"+tagName, "</"+tagName
	depth := 1
	for p := bodyStart; p < len(src); {
		if src[p] != '<' {
			p++
			continue
		}
		if strings.HasPrefix(src[p:], "<!--") {
			p = findCommentEnd(src, p)
			continue
		}
		if hasPrefixIgnoreCase(src, p, closeNeedle) && isEndTagBoundary(src, p+len(closeNeedle)) {
			p = parseTag(src, p, true).endIndex
			depth--
			if depth == 0 {
				return p
			}
			continue
		}
		if hasPrefixIgnoreCase(src, p, openNeedle) && isEndTagBoundary(src, p+len(openNeedle)) {
			tag := parseTag(src, p, false)
			p = tag.endIndex
			if !tag.selfClosing || (tagName != "svg" && tagName != "math") {
				depth++
			}
			continue
		}
		if p+1 < len(src) && (isASCIIAlpha(src[p+1]) || (src[p+1] == '/' && p+2 < len(src) && isASCIIAlpha(src[p+2]))) {
			p = parseTag(src, p, src[p+1] == '/').endIndex
			continue
		}
		p++
	}
	return len(src)
}

func findPreambleInsertPos(trimmed string) int {
	p := 0
	for p < len(trimmed) && isASCIIWhitespace(trimmed[p]) {
		p++
	}
	doctypeEnd := 0
	if hasPrefixIgnoreCase(trimmed, p, "<!doctype") && isEndTagBoundary(trimmed, p+9) {
		if rel := strings.IndexByte(trimmed[p+9:], '>'); rel != -1 && p+9+rel+1 <= 256 {
			doctypeEnd = p + 9 + rel + 1
			p = doctypeEnd
			for p < len(trimmed) && isASCIIWhitespace(trimmed[p]) {
				p++
			}
		}
	}
	if hasPrefixIgnoreCase(trimmed, p, "<html") && isEndTagBoundary(trimmed, p+5) {
		if htmlTag := parseTag(trimmed, p, false); htmlTag.closed && htmlTag.endIndex <= 1024 {
			p = htmlTag.endIndex
			for p < len(trimmed) && isASCIIWhitespace(trimmed[p]) {
				p++
			}
		}
	}
	if hasPrefixIgnoreCase(trimmed, p, "<head") && isEndTagBoundary(trimmed, p+5) {
		if headTag := parseTag(trimmed, p, false); headTag.closed && headTag.endIndex <= 2048 {
			return headTag.endIndex
		}
	}
	return doctypeEnd
}

func truncateUTF8Bytes(s string, maxBytes int) (string, bool) {
	if len(s) <= maxBytes {
		return s, false
	}
	out := s[:maxBytes]
	for len(out) > 0 && !utf8.ValidString(out) {
		out = out[:len(out)-1]
	}
	return out, true
}

func finalizeWithStrictCspAndCap(htmlText string) (string, bool) {
	trimmed := strings.TrimSpace(htmlText)
	if trimmed == "" {
		return strictSandboxCspMeta, false
	}
	insertPos := findPreambleInsertPos(trimmed)
	capped, truncated := truncateUTF8Bytes(trimmed, maxArtifactBytes-(len(strictSandboxCspMeta)+1))
	safeInsert := min(insertPos, len(capped))
	if safeInsert > 0 {
		return capped[:safeInsert] + "\n" + strictSandboxCspMeta + capped[safeInsert:], truncated
	}
	return strictSandboxCspMeta + "\n" + capped, truncated
}

func sanitizeArtifactHTML(raw string) (string, bool) {
	src := strings.TrimSpace(raw)
	if match := markdownFenceRe.FindStringSubmatch(src); len(match) == 2 {
		src = strings.TrimSpace(match[1])
	}
	stripped := false
	markStripped := func() { stripped = true }
	if strings.ContainsRune(src, '\x00') {
		src = strings.ReplaceAll(src, "\x00", "\uFFFD")
		stripped = true
	}

	var out strings.Builder
	for i := 0; i < len(src); {
		relLt := strings.IndexByte(src[i:], '<')
		textChunk := src[i:]
		if relLt != -1 {
			textChunk = src[i : i+relLt]
		}
		if textChunk != "" {
			out.WriteString(textChunk)
		}
		if relLt == -1 {
			break
		}
		i += relLt

		if strings.HasPrefix(src[i:], "<!--") {
			stripped = true
			i = findCommentEnd(src, i)
			continue
		}
		if hasPrefixIgnoreCase(src, i, "<!doctype") && isEndTagBoundary(src, i+9) {
			gt := strings.IndexByte(src[i+9:], '>')
			if gt == -1 {
				stripped = true
				break
			}
			out.WriteString(src[i : i+9+gt+1])
			i += 9 + gt + 1
			continue
		}
		if i+1 < len(src) && (src[i+1] == '!' || src[i+1] == '?') {
			stripped = true
			if gt := strings.IndexByte(src[i+2:], '>'); gt == -1 {
				break
			} else {
				i += 2 + gt + 1
			}
			continue
		}
		if i+1 < len(src) && src[i+1] == '/' {
			if i+2 >= len(src) || !isASCIIAlpha(src[i+2]) {
				stripped = true
				if gt := strings.IndexByte(src[i+2:], '>'); gt == -1 {
					break
				} else {
					i += 2 + gt + 1
				}
				continue
			}
			closeTag := parseTag(src, i, true)
			i = closeTag.endIndex
			if !closeTag.closed || !isValidIdentifierName(closeTag.tagName, false) || unsafeCloseTags[closeTag.tagName] {
				stripped = true
				continue
			}
			out.WriteString("</" + closeTag.tagName + ">")
			continue
		}
		if i+1 >= len(src) || !isASCIIAlpha(src[i+1]) {
			out.WriteString("&lt;")
			i++
			continue
		}

		openTag := parseTag(src, i, false)
		rawSlice := src[i:openTag.endIndex]
		i = openTag.endIndex
		if !openTag.closed || !isValidIdentifierName(openTag.tagName, false) {
			stripped = true
			continue
		}

		tagName := openTag.tagName
		switch {
		case tagName == "script":
			body, nextIdx, found := scanScriptBodyEnd(src, i)
			i = nextIdx
			if found && !openTag.selfClosing && len(openTag.attrs) == 0 && body == canonicalProbeScript {
				out.WriteString("<script>" + canonicalProbeScript + "</script>")
			} else {
				stripped = true
			}
		case blockedRawtextTags[tagName]:
			stripped = true
			_, i, _ = scanRawOrRcdataEnd(src, i, tagName)
		case blockedNestableTags[tagName]:
			stripped = true
			if !openTag.selfClosing || (tagName != "svg" && tagName != "math") {
				i = skipNestableContainer(src, i, tagName)
			}
		case blockedSingleTags[tagName]:
			stripped = true
		case rawtextRcdataSafeTags[tagName]:
			ser, _ := serializeSanitizedOpenTag(openTag, false, markStripped)
			body, nextIdx, found := scanRawOrRcdataEnd(src, i, tagName)
			i = nextIdx
			if !found {
				stripped = true
				continue
			}
			if tagName == "style" {
				if strings.Contains(body, "<") || strings.Contains(body, "-->") || hasUnsafeCSS(body) {
					stripped = true
					continue
				}
				out.WriteString(ser + body + "</style>")
			} else {
				if strings.Contains(body, "<") {
					stripped = true
				}
				out.WriteString(ser + escapeTagAngleBrackets(body) + "</" + tagName + ">")
			}
		default:
			ser, hasHTTPEquiv := serializeSanitizedOpenTag(openTag, voidHTMLTags[tagName], markStripped)
			if tagName == "meta" && hasHTTPEquiv {
				if strings.TrimSpace(rawSlice) == strictSandboxCspMeta {
					s := out.String()
					if strings.HasSuffix(s, "\n") {
						out.Reset()
						out.WriteString(s[:len(s)-1])
					}
				} else {
					stripped = true
				}
				continue
			}
			out.WriteString(ser)
		}
	}

	finalHTML, didTrunc := finalizeWithStrictCspAndCap(out.String())
	if didTrunc {
		stripped = true
	}
	if stripped {
		logCadenceSeam("BOUNDARY_FAULT", "cadence.gate.artifact_sanitized", "warn", map[string]any{
			"stripped":      true,
			"artifactBytes": len(finalHTML),
		})
	}
	return finalHTML, stripped
}
