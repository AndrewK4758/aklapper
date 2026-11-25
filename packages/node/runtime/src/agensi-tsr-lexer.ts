// Bounded context: Strictly non-executing pure-TS lexer and recursive-descent parser for Agensi TSR scripts.
// Invariant: Zero eval/Function/vm; hard token (65,536) and depth (32) caps.

export const MAX_TSR_TOKENS = 65_536;
export const MAX_TSR_DEPTH = 32;

export interface TsrToken {
  readonly kind: 'ident' | 'string' | 'number' | 'punct';
  readonly value: string;
}

export interface TsrRefPlaceholder {
  readonly __tsrRef: number;
}

export class TsrLimitError extends Error {
  readonly reason: string;

  constructor(reason: string, message: string) {
    super(message);
    this.reason = reason;
  }
}

export function isTsrRefPlaceholder(value: unknown): value is TsrRefPlaceholder {
  return (
    typeof value === 'object' &&
    value !== null &&
    '__tsrRef' in value &&
    typeof (value as Record<string, unknown>)['__tsrRef'] === 'number'
  );
}

const SIMPLE_ESCAPES: Readonly<Record<string, string>> = {
  n: '\n',
  r: '\r',
  t: '\t',
  b: '\b',
  f: '\f',
  '\\': '\\',
  '"': '"',
  "'": "'",
  '/': '/',
};

function decodeJsEscape(source: string, index: number): { char: string; nextIndex: number } {
  const ch = source[index] ?? '';
  if (ch in SIMPLE_ESCAPES) {
    return { char: SIMPLE_ESCAPES[ch] ?? ch, nextIndex: index + 1 };
  }
  if (ch === 'u' || ch === 'x') {
    const width = ch === 'u' ? 4 : 2;
    const hex = source.slice(index + 1, index + 1 + width);
    if (hex.length === width && /^[0-9a-fA-F]+$/.test(hex)) {
      return {
        char: String.fromCharCode(Number.parseInt(hex, 16)),
        nextIndex: index + 1 + width,
      };
    }
  }
  return { char: ch, nextIndex: index + 1 };
}

export function tokenizeTsrScript(source: string): TsrToken[] {
  const tokens: TsrToken[] = [];
  const len = source.length;
  let i = 0;

  while (i < len) {
    const ch = source[i] ?? '';
    if (ch <= ' ') {
      i += 1;
      continue;
    }
    if (ch === '/' && source[i + 1] === '/') {
      i += 2;
      while (i < len && source[i] !== '\n') i += 1;
      continue;
    }
    if (ch === '/' && source[i + 1] === '*') {
      i += 2;
      while (i + 1 < len && !(source[i] === '*' && source[i + 1] === '/')) i += 1;
      i += 2;
      continue;
    }
    if (tokens.length >= MAX_TSR_TOKENS) {
      throw new TsrLimitError('token_limit_exceeded', 'Agensi TSR stream exceeded token limit.');
    }
    if (ch === '"' || ch === "'") {
      const quote = ch;
      i += 1;
      let out = '';
      while (i < len && source[i] !== quote) {
        if (source[i] === '\\' && i + 1 < len) {
          const decoded = decodeJsEscape(source, i + 1);
          out += decoded.char;
          i = decoded.nextIndex;
        } else {
          out += source[i] ?? '';
          i += 1;
        }
      }
      i += 1;
      tokens.push({ kind: 'string', value: out });
      continue;
    }
    if (
      (ch >= '0' && ch <= '9') ||
      (ch === '-' && (source[i + 1] ?? '') >= '0' && (source[i + 1] ?? '') <= '9')
    ) {
      let end = i + 1;
      while (end < len && /[0-9.eE+-]/.test(source[end] ?? '')) end += 1;
      tokens.push({ kind: 'number', value: source.slice(i, end) });
      i = end;
      continue;
    }
    if (/[a-zA-Z_$]/.test(ch)) {
      let end = i + 1;
      while (end < len && /[a-zA-Z0-9_$]/.test(source[end] ?? '')) end += 1;
      tokens.push({ kind: 'ident', value: source.slice(i, end) });
      i = end;
      continue;
    }
    if (ch === '=' && source[i + 1] === '>') {
      tokens.push({ kind: 'punct', value: '=>' });
      i += 2;
      continue;
    }
    tokens.push({ kind: 'punct', value: ch });
    i += 1;
  }
  return tokens;
}

class TsrExpressionParser {
  private readonly tokens: readonly TsrToken[];
  private readonly refs: Map<number, unknown>;
  private pos = 0;
  private depth = 0;

  constructor(tokens: readonly TsrToken[], refs: Map<number, unknown>) {
    this.tokens = tokens;
    this.refs = refs;
  }

  private peek(): TsrToken | undefined {
    return this.tokens[this.pos];
  }

  private consume(): TsrToken | undefined {
    const tok = this.tokens[this.pos];
    this.pos += 1;
    return tok;
  }

  private matchPunct(val: string): boolean {
    if (this.peek()?.kind === 'punct' && this.peek()?.value === val) {
      this.pos += 1;
      return true;
    }
    return false;
  }

  parseAll(): unknown[] {
    const results: unknown[] = [];
    while (this.pos < this.tokens.length) {
      if (this.matchPunct(';') || this.matchPunct(',')) continue;
      const before = this.pos;
      const val = this.parseExpression();
      if (val !== undefined) results.push(val);
      if (this.pos === before) this.pos += 1;
    }
    return results;
  }

  private parseExpression(): unknown {
    this.depth += 1;
    if (this.depth > MAX_TSR_DEPTH) {
      throw new TsrLimitError('depth_limit_exceeded', 'Agensi TSR stream exceeded nesting limit.');
    }
    try {
      return this.parsePostfixAndAssign(this.parseUnary());
    } finally {
      this.depth -= 1;
    }
  }

  private parseUnary(): unknown {
    const tok = this.peek();
    if (!tok) return undefined;
    if (tok.kind === 'punct' && tok.value === '!') {
      this.consume();
      const operand = this.parseUnary();
      return operand === 0 ? true : operand === 1 ? false : !operand;
    }
    if (tok.kind === 'ident' && tok.value === 'void') {
      this.consume();
      this.parseUnary();
      return undefined;
    }
    if (tok.kind === 'ident' && tok.value === 'new') {
      this.consume();
      const ctor = this.consume()?.value ?? '';
      const args = this.matchPunct('(') ? this.parseList(')') : [];
      return ctor === 'Set' && Array.isArray(args[0]) ? args[0] : (args[0] ?? null);
    }
    if (tok.kind === 'ident' && tok.value === 'function') {
      this.consume();
      if (this.peek()?.kind === 'ident') this.consume();
      if (this.matchPunct('(')) this.parseList(')');
      return this.matchPunct('{') ? this.parseBlock() : undefined;
    }
    return this.parsePrimary();
  }

  private parsePrimary(): unknown {
    const tok = this.peek();
    if (!tok) return undefined;
    if (tok.kind === 'string') return this.consume()?.value;
    if (tok.kind === 'number') return Number(this.consume()?.value);
    if (tok.kind === 'punct' && tok.value === '{') return this.parseObject();
    if (tok.kind === 'punct' && tok.value === '[') {
      this.consume();
      return this.parseList(']');
    }
    if (tok.kind === 'punct' && tok.value === '(') {
      this.consume();
      const items = this.parseList(')');
      if (this.matchPunct('=>')) {
        return this.matchPunct('{') ? this.parseBlock() : this.parseExpression();
      }
      return items[items.length - 1];
    }
    if (tok.kind === 'ident') {
      this.consume();
      if (this.matchPunct('=>')) {
        return this.matchPunct('{') ? this.parseBlock() : this.parseExpression();
      }
      if (tok.value === 'true') return true;
      if (tok.value === 'false') return false;
      if (tok.value === 'null') return null;
      if (tok.value === 'undefined') return undefined;
      if (tok.value === '$R' && this.matchPunct('[')) {
        const idxTok = this.consume();
        this.matchPunct(']');
        const refIdx = idxTok?.kind === 'number' ? Number(idxTok.value) : NaN;
        if (Number.isInteger(refIdx) && refIdx >= 0) {
          if (this.matchPunct('=')) {
            const assigned = this.parseExpression();
            this.refs.set(refIdx, assigned);
            return assigned;
          }
          return this.refs.has(refIdx)
            ? this.refs.get(refIdx)
            : ({ __tsrRef: refIdx } as TsrRefPlaceholder);
        }
      }
      return tok.value;
    }
    return undefined;
  }

  private parseBlock(): unknown[] {
    const bodyValues: unknown[] = [];
    while (this.pos < this.tokens.length && !this.matchPunct('}')) {
      if (this.matchPunct(';') || this.matchPunct(',')) continue;
      if (this.peek()?.kind === 'ident' && this.peek()?.value === 'return') this.consume();
      const before = this.pos;
      const val = this.parseExpression();
      if (val !== undefined) bodyValues.push(val);
      if (this.pos === before) this.pos += 1;
    }
    return bodyValues;
  }

  private parsePostfixAndAssign(initial: unknown): unknown {
    let current = initial;
    while (this.pos < this.tokens.length) {
      if (this.matchPunct('.')) {
        const prop = this.consume()?.value ?? '';
        current = typeof current === 'string' ? `${current}.${prop}` : current;
        continue;
      }
      if (this.matchPunct('(')) {
        const args = this.parseList(')');
        if (current === 'Object.assign' && args.length >= 2) {
          const [target, source] = args;
          if (target && typeof target === 'object' && source && typeof source === 'object') {
            Object.assign(target, source);
          }
          current = target;
        } else {
          current = args;
        }
        continue;
      }
      if (this.matchPunct('=')) {
        current = this.parseExpression();
        continue;
      }
      break;
    }
    return current;
  }

  private parseList(closePunct: string): unknown[] {
    const items: unknown[] = [];
    while (this.pos < this.tokens.length && !this.matchPunct(closePunct)) {
      if (this.matchPunct(',')) {
        items.push(undefined);
        continue;
      }
      const before = this.pos;
      items.push(this.parseExpression());
      this.matchPunct(',');
      if (this.pos === before) this.pos += 1;
    }
    return items;
  }

  private parseObject(): Record<string, unknown> {
    this.consume();
    const obj: Record<string, unknown> = {};
    while (this.pos < this.tokens.length && !this.matchPunct('}')) {
      const keyTok = this.consume();
      if (!keyTok) break;
      if (!this.matchPunct(':')) {
        this.matchPunct(',');
        continue;
      }
      const value = this.parseExpression();
      if (
        keyTok.value !== '__proto__' &&
        keyTok.value !== 'constructor' &&
        keyTok.value !== 'prototype'
      ) {
        obj[keyTok.value] = value;
      }
      this.matchPunct(',');
    }
    return obj;
  }
}

export function parseTsrScriptBody(scriptBody: string, refs: Map<number, unknown>): unknown[] {
  return new TsrExpressionParser(tokenizeTsrScript(scriptBody), refs).parseAll();
}
