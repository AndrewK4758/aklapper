package agensi

import (
	"errors"
	"strconv"
	"strings"
)

const (
	MaxTSRTokens = 65536
	MaxTSRDepth  = 32
)

type tsrToken struct {
	kind  string // ident | string | number | punct
	value string
}

type tsrRefPlaceholder struct {
	refIdx int
}

type tsrLimitError struct {
	reason  string
	message string
}

func (e *tsrLimitError) Error() string { return e.message }

func decodeJSEscape(source string, idx int) (string, int) {
	if idx >= len(source) {
		return "", idx
	}
	ch := source[idx]
	switch ch {
	case 'n':
		return "\n", idx + 1
	case 'r':
		return "\r", idx + 1
	case 't':
		return "\t", idx + 1
	case 'b':
		return "\b", idx + 1
	case 'f':
		return "\f", idx + 1
	case '\\', '"', '\'', '/':
		return string(ch), idx + 1
	case 'u', 'x':
		width := 2
		if ch == 'u' {
			width = 4
		}
		if idx+1+width <= len(source) {
			hexStr := source[idx+1 : idx+1+width]
			if cp, err := strconv.ParseInt(hexStr, 16, 32); err == nil {
				return string(rune(cp)), idx + 1 + width
			}
		}
	}
	return string(ch), idx + 1
}

func isIdentStart(b byte) bool {
	return (b >= 'a' && b <= 'z') || (b >= 'A' && b <= 'Z') || b == '_' || b == '$'
}

func isIdentPart(b byte) bool {
	return isIdentStart(b) || (b >= '0' && b <= '9')
}

func isNumberPart(b byte) bool {
	return (b >= '0' && b <= '9') || b == '.' || b == 'e' || b == 'E' || b == '+' || b == '-'
}

func tokenizeTSRScript(source string) ([]tsrToken, error) {
	tokens := make([]tsrToken, 0, 128)
	n := len(source)
	i := 0
	for i < n {
		ch := source[i]
		if ch <= ' ' {
			i++
			continue
		}
		if ch == '/' && i+1 < n && source[i+1] == '/' {
			i += 2
			for i < n && source[i] != '\n' {
				i++
			}
			continue
		}
		if ch == '/' && i+1 < n && source[i+1] == '*' {
			i += 2
			for i+1 < n && !(source[i] == '*' && source[i+1] == '/') {
				i++
			}
			i += 2
			continue
		}
		if len(tokens) >= MaxTSRTokens {
			return nil, &tsrLimitError{
				reason:  "token_limit_exceeded",
				message: "Agensi TSR stream exceeded token limit.",
			}
		}
		if ch == '"' || ch == '\'' {
			quote := ch
			i++
			var sb strings.Builder
			for i < n && source[i] != quote {
				if source[i] == '\\' && i+1 < n {
					decoded, next := decodeJSEscape(source, i+1)
					sb.WriteString(decoded)
					i = next
				} else {
					sb.WriteByte(source[i])
					i++
				}
			}
			if i < n {
				i++
			}
			tokens = append(tokens, tsrToken{kind: "string", value: sb.String()})
			continue
		}
		if (ch >= '0' && ch <= '9') || (ch == '-' && i+1 < n && source[i+1] >= '0' && source[i+1] <= '9') {
			end := i + 1
			for end < n && isNumberPart(source[end]) {
				end++
			}
			tokens = append(tokens, tsrToken{kind: "number", value: source[i:end]})
			i = end
			continue
		}
		if isIdentStart(ch) {
			end := i + 1
			for end < n && isIdentPart(source[end]) {
				end++
			}
			tokens = append(tokens, tsrToken{kind: "ident", value: source[i:end]})
			i = end
			continue
		}
		if ch == '=' && i+1 < n && source[i+1] == '>' {
			tokens = append(tokens, tsrToken{kind: "punct", value: "=>"})
			i += 2
			continue
		}
		tokens = append(tokens, tsrToken{kind: "punct", value: string(ch)})
		i++
	}
	return tokens, nil
}

func isTSRLimitError(err error) (*tsrLimitError, bool) {
	var lim *tsrLimitError
	if errors.As(err, &lim) {
		return lim, true
	}
	return nil, false
}
