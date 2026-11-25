package main

import (
	"html"
	"strings"
	"unicode/utf8"
)

const (
	maxArtifactBytes     = 48 * 1024
	canonicalProbeScript = `(function(){var c=0,b=document.getElementById('ping-btn'),o=document.getElementById('probe-val');if(b&&o){var p=o.getAttribute('data-probe-prefix')||o.textContent||'probe';b.addEventListener('click',function(){c+=1;o.textContent=p+' #'+c;});}})();`
	strictSandboxCspMeta = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'sha256-B0vaSeHTnSWoVee69pbJTQb3o4Bao8IjCqTjjpMMNhc='; base-uri 'none'; form-action 'none';" />`
)

var (
	blockedRawtextTags    = map[string]bool{"iframe": true, "noembed": true, "noframes": true, "noscript": true, "xmp": true}
	blockedNestableTags   = map[string]bool{"object": true, "applet": true, "foreignobject": true, "template": true, "svg": true, "math": true}
	blockedSingleTags     = map[string]bool{"embed": true, "base": true, "link": true, "frame": true, "frameset": true, "portal": true, "plaintext": true, "isindex": true, "set": true, "animate": true, "animatemotion": true, "animatetransform": true, "mpath": true, "handler": true, "listener": true}
	rawtextRcdataSafeTags = map[string]bool{"style": true, "title": true, "textarea": true}
	uriAttrs              = map[string]bool{"href": true, "xlink:href": true, "src": true, "action": true, "formaction": true, "data": true, "poster": true, "background": true, "cite": true, "codebase": true, "longdesc": true, "manifest": true, "profile": true, "usemap": true}
	uriListAttrs          = map[string]bool{"srcset": true, "imagesrcset": true}
	unsafeCloseTags       = map[string]bool{"iframe": true, "noembed": true, "noframes": true, "noscript": true, "xmp": true, "object": true, "applet": true, "foreignobject": true, "template": true, "svg": true, "math": true, "embed": true, "base": true, "link": true, "frame": true, "frameset": true, "portal": true, "plaintext": true, "isindex": true, "set": true, "animate": true, "animatemotion": true, "animatetransform": true, "mpath": true, "handler": true, "listener": true, "style": true, "title": true, "textarea": true, "script": true}
	voidHTMLTags          = map[string]bool{"area": true, "base": true, "basefont": true, "bgsound": true, "br": true, "col": true, "embed": true, "frame": true, "hr": true, "img": true, "input": true, "keygen": true, "link": true, "meta": true, "param": true, "source": true, "track": true, "wbr": true}
)

type parsedAttr struct {
	name     string
	hasValue bool
	value    string
}

type parsedTag struct {
	tagName     string
	attrs       []parsedAttr
	selfClosing bool
	endIndex    int
	closed      bool
}

func escapeHTMLAttrValue(raw string) string {
	var b strings.Builder
	b.Grow(len(raw))
	for i := 0; i < len(raw); i++ {
		switch raw[i] {
		case '&':
			b.WriteString("&amp;")
		case '<':
			b.WriteString("&lt;")
		case '>':
			b.WriteString("&gt;")
		case '"':
			b.WriteString("&quot;")
		case '\'':
			b.WriteString("&#39;")
		default:
			b.WriteByte(raw[i])
		}
	}
	return b.String()
}

func escapeTagAngleBrackets(raw string) string {
	var b strings.Builder
	b.Grow(len(raw))
	for i := 0; i < len(raw); i++ {
		switch raw[i] {
		case '<':
			b.WriteString("&lt;")
		case '>':
			b.WriteString("&gt;")
		default:
			b.WriteByte(raw[i])
		}
	}
	return b.String()
}

func isASCIIWhitespace(b byte) bool {
	return b == ' ' || b == '\t' || b == '\n' || b == '\f' || b == '\r'
}

func isASCIIAlpha(b byte) bool {
	return (b >= 'a' && b <= 'z') || (b >= 'A' && b <= 'Z')
}

func isEndTagBoundary(src string, idx int) bool {
	return idx < len(src) && (isASCIIWhitespace(src[idx]) || src[idx] == '/' || src[idx] == '>')
}

func hasPrefixIgnoreCase(src string, start int, needle string) bool {
	return start+len(needle) <= len(src) && strings.EqualFold(src[start:start+len(needle)], needle)
}

func isValidIdentifierName(name string, allowUnderscore bool) bool {
	if name == "" {
		return false
	}
	for i := 0; i < len(name); i++ {
		c := name[i]
		ok := (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '-' || c == ':' || (allowUnderscore && c == '_')
		if !ok {
			return false
		}
	}
	return true
}

func stripASCIIControlsAndSpace(s string) string {
	var b strings.Builder
	b.Grow(len(s))
	for i := 0; i < len(s); i++ {
		if s[i] > 0x20 && s[i] != 0x7f {
			b.WriteByte(s[i])
		}
	}
	return b.String()
}

func isAllowedURI(rawValue string) bool {
	norm := stripASCIIControlsAndSpace(html.UnescapeString(rawValue))
	if norm == "" || norm[0] == '#' {
		return true
	}
	if norm[0] == '/' {
		return len(norm) == 1 || (norm[1] != '/' && norm[1] != '\\')
	}
	lower := strings.ToLower(norm)
	if strings.HasPrefix(lower, "https://") || strings.HasPrefix(lower, "http://") {
		return true
	}
	if norm[0] == '\\' {
		return false
	}
	for i := 0; i < len(norm); i++ {
		switch norm[i] {
		case '/', '?', '#':
			return true
		case ':', '\\':
			return false
		}
	}
	return true
}

func isAllowedSrcset(decodedValue string) bool {
	for _, part := range strings.Split(decodedValue, ",") {
		trimmed := strings.TrimSpace(part)
		if trimmed == "" {
			continue
		}
		urlEnd := 0
		for urlEnd < len(trimmed) && !isASCIIWhitespace(trimmed[urlEnd]) {
			urlEnd++
		}
		if !isAllowedURI(trimmed[:urlEnd]) {
			return false
		}
	}
	return true
}

func hasUnsafeCSS(rawCSS string) bool {
	src := strings.ReplaceAll(strings.ReplaceAll(strings.ReplaceAll(rawCSS, "\r\n", "\n"), "\r", "\n"), "\f", "\n")
	var decoded strings.Builder
	var quote byte
	for i := 0; i < len(src); {
		ch := src[i]
		if quote == 0 && i+1 < len(src) && ch == '/' && src[i+1] == '*' {
			end := strings.Index(src[i+2:], "*/")
			if end == -1 {
				break
			}
			i += 2 + end + 2
			continue
		}
		if quote == 0 && (ch == '"' || ch == '\'') {
			quote = ch
			decoded.WriteByte(ch)
			i++
			continue
		}
		if quote != 0 && (ch == quote || ch == '\n') {
			quote = 0
			decoded.WriteByte(ch)
			i++
			continue
		}
		if ch != '\\' || i+1 >= len(src) {
			decoded.WriteByte(ch)
			i++
			continue
		}
		p := i + 1
		var val rune
		for p < len(src) && p-(i+1) < 6 {
			c := src[p]
			var d rune
			switch {
			case c >= '0' && c <= '9':
				d = rune(c - '0')
			case c >= 'a' && c <= 'f':
				d = rune(c-'a') + 10
			case c >= 'A' && c <= 'F':
				d = rune(c-'A') + 10
			default:
				goto done
			}
			val = val*16 + d
			p++
		}
	done:
		if p == i+1 {
			decoded.WriteByte(src[i+1])
			i += 2
			continue
		}
		if p < len(src) && isASCIIWhitespace(src[p]) {
			p++
		}
		if val <= 0 || val > utf8.MaxRune || !utf8.ValidRune(val) {
			decoded.WriteRune('\uFFFD')
		} else {
			decoded.WriteRune(val)
		}
		i = p
	}
	compact := strings.ToLower(stripASCIIControlsAndSpace(decoded.String()))
	return strings.Contains(compact, "@import") ||
		strings.Contains(compact, "expression(") ||
		strings.Contains(compact, "javascript:") ||
		strings.Contains(compact, "vbscript:") ||
		strings.Contains(compact, "data:") ||
		strings.Contains(compact, "-moz-binding") ||
		strings.Contains(compact, "behavior:")
}

func parseTag(src string, start int, isClose bool) parsedTag {
	n := len(src)
	p := start + 1
	if isClose {
		p = start + 2
	}
	nameStart := p
	for p < n && !isASCIIWhitespace(src[p]) && src[p] != '/' && src[p] != '>' {
		p++
	}
	tagName := strings.ToLower(src[nameStart:p])
	var attrs []parsedAttr

	for p < n {
		for p < n && isASCIIWhitespace(src[p]) {
			p++
		}
		if p >= n {
			return parsedTag{tagName: tagName, attrs: attrs, endIndex: n}
		}
		if src[p] == '>' {
			return parsedTag{tagName: tagName, attrs: attrs, endIndex: p + 1, closed: true}
		}
		if src[p] == '/' {
			if p+1 < n && src[p+1] == '>' {
				return parsedTag{tagName: tagName, attrs: attrs, selfClosing: true, endIndex: p + 2, closed: true}
			}
			p++
			continue
		}
		attrStart := p
		for p < n && !isASCIIWhitespace(src[p]) && src[p] != '=' && src[p] != '/' && src[p] != '>' {
			p++
		}
		name := strings.ToLower(src[attrStart:p])
		for p < n && isASCIIWhitespace(src[p]) {
			p++
		}
		hasValue, value := false, ""
		if p < n && src[p] == '=' {
			hasValue = true
			p++
			for p < n && isASCIIWhitespace(src[p]) {
				p++
			}
			if p < n && (src[p] == '"' || src[p] == '\'') {
				quote := src[p]
				p++
				valStart := p
				for p < n && src[p] != quote {
					p++
				}
				value = src[valStart:p]
				if p < n && src[p] == quote {
					p++
				}
			} else {
				valStart := p
				for p < n && !isASCIIWhitespace(src[p]) && src[p] != '>' {
					p++
				}
				value = src[valStart:p]
			}
		}
		if name != "" {
			attrs = append(attrs, parsedAttr{name: name, hasValue: hasValue, value: value})
		}
	}
	return parsedTag{tagName: tagName, attrs: attrs, endIndex: n}
}

func serializeSanitizedOpenTag(tag parsedTag, honorSelfClosing bool, markStripped func()) (string, bool) {
	seen := make(map[string]bool, len(tag.attrs))
	var b strings.Builder
	b.WriteByte('<')
	b.WriteString(tag.tagName)
	hasHTTPEquiv := false

	for _, attr := range tag.attrs {
		name := attr.name
		if name == "http-equiv" {
			hasHTTPEquiv = true
		}
		isEventHandler := len(name) > 2 && strings.HasPrefix(name, "on") && isASCIIAlpha(name[2])
		if isEventHandler || name == "srcdoc" || name == "ping" || !isValidIdentifierName(name, true) {
			markStripped()
			continue
		}
		if !attr.hasValue {
			if !seen[name] {
				seen[name] = true
				b.WriteByte(' ')
				b.WriteString(name)
			}
			continue
		}
		decoded := html.UnescapeString(attr.value)
		dropAttr := false
		if uriAttrs[name] && !isAllowedURI(attr.value) {
			decoded = "#blocked"
			markStripped()
		} else if uriListAttrs[name] && !isAllowedSrcset(decoded) {
			markStripped()
			dropAttr = true
		} else if name == "style" && hasUnsafeCSS(decoded) {
			markStripped()
			dropAttr = true
		}
		if seen[name] || dropAttr {
			continue
		}
		seen[name] = true
		b.WriteByte(' ')
		b.WriteString(name)
		b.WriteString(`="`)
		b.WriteString(escapeHTMLAttrValue(decoded))
		b.WriteByte('"')
	}
	if honorSelfClosing && tag.selfClosing {
		b.WriteString(" />")
	} else {
		b.WriteByte('>')
	}
	return b.String(), hasHTTPEquiv
}
