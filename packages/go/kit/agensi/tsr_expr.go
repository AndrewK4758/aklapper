package agensi

import "strconv"

type tsrExprParser struct {
	tokens []tsrToken
	refs   map[int]any
	pos    int
	depth  int
}

func (p *tsrExprParser) peek() (tsrToken, bool) {
	if p.pos >= len(p.tokens) {
		return tsrToken{}, false
	}
	return p.tokens[p.pos], true
}

func (p *tsrExprParser) consume() (tsrToken, bool) {
	if p.pos >= len(p.tokens) {
		return tsrToken{}, false
	}
	t := p.tokens[p.pos]
	p.pos++
	return t, true
}

func (p *tsrExprParser) matchPunct(val string) bool {
	if t, ok := p.peek(); ok && t.kind == "punct" && t.value == val {
		p.pos++
		return true
	}
	return false
}

func (p *tsrExprParser) parseAll() ([]any, error) {
	results := make([]any, 0)
	for p.pos < len(p.tokens) {
		if p.matchPunct(";") || p.matchPunct(",") {
			continue
		}
		before := p.pos
		val, err := p.parseExpression()
		if err != nil {
			return nil, err
		}
		if val != nil {
			results = append(results, val)
		}
		if p.pos == before {
			p.pos++
		}
	}
	return results, nil
}

func (p *tsrExprParser) parseExpression() (any, error) {
	p.depth++
	if p.depth > MaxTSRDepth {
		return nil, &tsrLimitError{
			reason:  "depth_limit_exceeded",
			message: "Agensi TSR stream exceeded nesting limit.",
		}
	}
	defer func() { p.depth-- }()
	val, err := p.parseUnary()
	if err != nil {
		return nil, err
	}
	return p.parsePostfixAndAssign(val)
}

func (p *tsrExprParser) parseUnary() (any, error) {
	tok, ok := p.peek()
	if !ok {
		return nil, nil
	}
	if tok.kind == "punct" && tok.value == "!" {
		p.consume()
		op, err := p.parseUnary()
		if err != nil {
			return nil, err
		}
		switch v := op.(type) {
		case float64:
			return v == 0, nil
		case bool:
			return !v, nil
		case nil:
			return true, nil
		default:
			return false, nil
		}
	}
	if tok.kind == "ident" && tok.value == "void" {
		p.consume()
		_, err := p.parseUnary()
		return nil, err
	}
	if tok.kind == "ident" && tok.value == "new" {
		p.consume()
		ctor, _ := p.consume()
		var args []any
		var err error
		if p.matchPunct("(") {
			args, err = p.parseList(")")
			if err != nil {
				return nil, err
			}
		}
		if ctor.value == "Set" && len(args) > 0 {
			if arr, isArr := args[0].([]any); isArr {
				return arr, nil
			}
		}
		if len(args) > 0 {
			return args[0], nil
		}
		return nil, nil
	}
	if tok.kind == "ident" && tok.value == "function" {
		p.consume()
		if nxt, has := p.peek(); has && nxt.kind == "ident" {
			p.consume()
		}
		if p.matchPunct("(") {
			if _, err := p.parseList(")"); err != nil {
				return nil, err
			}
		}
		if p.matchPunct("{") {
			return p.parseBlock()
		}
		return nil, nil
	}
	return p.parsePrimary()
}

func (p *tsrExprParser) parsePrimary() (any, error) {
	tok, ok := p.peek()
	if !ok {
		return nil, nil
	}
	if tok.kind == "string" {
		p.consume()
		return tok.value, nil
	}
	if tok.kind == "number" {
		p.consume()
		f, _ := strconv.ParseFloat(tok.value, 64)
		return f, nil
	}
	if tok.kind == "punct" && tok.value == "{" {
		return p.parseObject()
	}
	if tok.kind == "punct" && tok.value == "[" {
		p.consume()
		return p.parseList("]")
	}
	if tok.kind == "punct" && tok.value == "(" {
		p.consume()
		items, err := p.parseList(")")
		if err != nil {
			return nil, err
		}
		if p.matchPunct("=>") {
			if p.matchPunct("{") {
				return p.parseBlock()
			}
			return p.parseExpression()
		}
		if len(items) > 0 {
			return items[len(items)-1], nil
		}
		return nil, nil
	}
	if tok.kind == "ident" {
		p.consume()
		if p.matchPunct("=>") {
			if p.matchPunct("{") {
				return p.parseBlock()
			}
			return p.parseExpression()
		}
		switch tok.value {
		case "true":
			return true, nil
		case "false":
			return false, nil
		case "null", "undefined":
			return nil, nil
		case "$R":
			if p.matchPunct("[") {
				idxTok, _ := p.consume()
				p.matchPunct("]")
				if idxTok.kind == "number" {
					if refIdx, err := strconv.Atoi(idxTok.value); err == nil && refIdx >= 0 {
						if p.matchPunct("=") {
							assigned, err := p.parseExpression()
							if err != nil {
								return nil, err
							}
							p.refs[refIdx] = assigned
							return assigned, nil
						}
						if existing, found := p.refs[refIdx]; found {
							return existing, nil
						}
						return tsrRefPlaceholder{refIdx: refIdx}, nil
					}
				}
			}
		}
		return tok.value, nil
	}
	return nil, nil
}

func (p *tsrExprParser) parseBlock() ([]any, error) {
	body := make([]any, 0)
	for p.pos < len(p.tokens) && !p.matchPunct("}") {
		if p.matchPunct(";") || p.matchPunct(",") {
			continue
		}
		if nxt, ok := p.peek(); ok && nxt.kind == "ident" && nxt.value == "return" {
			p.consume()
		}
		before := p.pos
		val, err := p.parseExpression()
		if err != nil {
			return nil, err
		}
		if val != nil {
			body = append(body, val)
		}
		if p.pos == before {
			p.pos++
		}
	}
	return body, nil
}

func (p *tsrExprParser) parsePostfixAndAssign(initial any) (any, error) {
	current := initial
	for p.pos < len(p.tokens) {
		if p.matchPunct(".") {
			prop, _ := p.consume()
			if s, ok := current.(string); ok {
				current = s + "." + prop.value
			}
			continue
		}
		if p.matchPunct("(") {
			args, err := p.parseList(")")
			if err != nil {
				return nil, err
			}
			if s, ok := current.(string); ok && s == "Object.assign" && len(args) >= 2 {
				target, tOK := args[0].(map[string]any)
				src, sOK := args[1].(map[string]any)
				if tOK && sOK {
					for k, v := range src {
						target[k] = v
					}
				}
				current = args[0]
			} else {
				current = args
			}
			continue
		}
		if p.matchPunct("=") {
			rhs, err := p.parseExpression()
			if err != nil {
				return nil, err
			}
			current = rhs
			continue
		}
		break
	}
	return current, nil
}

func (p *tsrExprParser) parseList(closePunct string) ([]any, error) {
	items := make([]any, 0)
	for p.pos < len(p.tokens) && !p.matchPunct(closePunct) {
		if p.matchPunct(",") {
			items = append(items, nil)
			continue
		}
		before := p.pos
		val, err := p.parseExpression()
		if err != nil {
			return nil, err
		}
		items = append(items, val)
		p.matchPunct(",")
		if p.pos == before {
			p.pos++
		}
	}
	return items, nil
}

func (p *tsrExprParser) parseObject() (map[string]any, error) {
	p.consume()
	obj := make(map[string]any)
	for p.pos < len(p.tokens) && !p.matchPunct("}") {
		keyTok, ok := p.consume()
		if !ok {
			break
		}
		if !p.matchPunct(":") {
			p.matchPunct(",")
			continue
		}
		val, err := p.parseExpression()
		if err != nil {
			return nil, err
		}
		if keyTok.value != "__proto__" && keyTok.value != "constructor" && keyTok.value != "prototype" {
			obj[keyTok.value] = val
		}
		p.matchPunct(",")
	}
	return obj, nil
}

func parseTSRScriptBody(scriptBody string, refs map[int]any) ([]any, error) {
	tokens, err := tokenizeTSRScript(scriptBody)
	if err != nil {
		return nil, err
	}
	parser := &tsrExprParser{tokens: tokens, refs: refs}
	return parser.parseAll()
}
