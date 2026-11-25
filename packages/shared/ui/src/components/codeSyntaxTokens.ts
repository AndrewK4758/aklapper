export type SyntaxTokenKind = 'plain' | 'tag' | 'attr' | 'string' | 'comment' | 'punct';

export interface SyntaxToken {
  readonly kind: SyntaxTokenKind;
  readonly text: string;
}

const TOKEN_PATTERN =
  /(<!--[\s\S]*?-->|\/\*[\s\S]*?\*\/|<\/?[a-zA-Z][\w:-]*|\/?>|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|\b[a-zA-Z_:][\w:.-]*(?=\s*=))/gu;

export function tokenizeMarkupLine(line: string): readonly SyntaxToken[] {
  if (line.length === 0) {
    return [];
  }
  const tokens: SyntaxToken[] = [];
  let cursor = 0;

  for (const match of line.matchAll(TOKEN_PATTERN)) {
    const start = match.index ?? 0;
    const text = match[0];
    if (start > cursor) {
      tokens.push({ kind: 'plain', text: line.slice(cursor, start) });
    }

    let kind: SyntaxTokenKind = 'plain';
    if (text.startsWith('<!--') || text.startsWith('/*')) {
      kind = 'comment';
    } else if (text.startsWith('<')) {
      kind = 'tag';
    } else if (text === '>' || text === '/>') {
      kind = 'punct';
    } else if (text.startsWith('"') || text.startsWith("'")) {
      kind = 'string';
    } else {
      kind = 'attr';
    }

    tokens.push({ kind, text });
    cursor = start + text.length;
  }

  if (cursor < line.length) {
    tokens.push({ kind: 'plain', text: line.slice(cursor) });
  }
  return tokens;
}

export function computeUtf8ByteLength(source: string): number {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(source).byteLength;
  }
  return source.length;
}
