const LEGACY_UNTERMINATED_ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  AMP: '&',
  lt: '<',
  LT: '<',
  gt: '>',
  GT: '>',
  quot: '"',
  QUOT: '"',
};

const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  ...LEGACY_UNTERMINATED_ENTITIES,
  apos: "'",
  Tab: '\t',
  NewLine: '\n',
  colon: ':',
  sol: '/',
  bsol: '\\',
  num: '#',
  lpar: '(',
  rpar: ')',
  plus: '+',
  semi: ';',
  comma: ',',
  period: '.',
  commat: '@',
  equals: '=',
  excl: '!',
  ast: '*',
  midast: '*',
  dollar: '$',
  percnt: '%',
  quest: '?',
  lowbar: '_',
  UnderBar: '_',
  lsqb: '[',
  lbrack: '[',
  rsqb: ']',
  rbrack: ']',
  lcub: '{',
  lbrace: '{',
  rcub: '}',
  rbrace: '}',
  verbar: '|',
  vert: '|',
  VerticalLine: '|',
  Hat: '^',
  grave: '`',
  DiacriticalGrave: '`',
  fjlig: 'fj',
  nbsp: '\u00a0',
  NonBreakingSpace: '\u00a0',
  ensp: '\u2002',
  emsp: '\u2003',
  emsp13: '\u2004',
  emsp14: '\u2005',
  numsp: '\u2007',
  puncsp: '\u2008',
  thinsp: '\u2009',
  ThinSpace: '\u2009',
  hairsp: '\u200a',
  VeryThinSpace: '\u200a',
  MediumSpace: '\u205f',
  ThickSpace: '\u205f\u200a',
  ZeroWidthSpace: '\u200b',
  NegativeThinSpace: '\u200b',
  NegativeMediumSpace: '\u200b',
  NegativeThickSpace: '\u200b',
  NegativeVeryThinSpace: '\u200b',
};

export function escapeCadenceHtml(raw: string): string {
  return raw
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function escapeTagAngleBrackets(raw: string): string {
  return raw.replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

export function isAsciiSpace(ch: string): boolean {
  return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\f' || ch === '\r';
}

export function isAsciiAlpha(ch: string): boolean {
  const code = ch.charCodeAt(0);
  return (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
}

function isAsciiAlphaNum(code: number): boolean {
  return (code >= 65 && code <= 90) || (code >= 97 && code <= 122) || (code >= 48 && code <= 57);
}

export function isEndTagBoundary(ch: string | undefined): boolean {
  return ch !== undefined && (isAsciiSpace(ch) || ch === '/' || ch === '>');
}

export function startsWithIgnoreCase(src: string, index: number, needle: string): boolean {
  return (
    index + needle.length <= src.length &&
    src.slice(index, index + needle.length).toLowerCase() === needle
  );
}

export function isValidIdentifierName(name: string, allowUnderscore: boolean): boolean {
  if (!name) return false;
  for (let i = 0; i < name.length; i += 1) {
    const c = name.charCodeAt(i);
    if (
      !(
        (c >= 97 && c <= 122) ||
        (c >= 48 && c <= 57) ||
        c === 45 ||
        c === 58 ||
        (allowUnderscore && c === 95)
      )
    ) {
      return false;
    }
  }
  return true;
}

export function sanitizeCodePoint(cp: number): string {
  if (!Number.isFinite(cp) || cp <= 0 || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff))
    return '\uFFFD';
  return String.fromCodePoint(cp);
}

export function stripAsciiControlsAndSpace(input: string): string {
  let out = '';
  for (let i = 0; i < input.length; i += 1) {
    const code = input.charCodeAt(i);
    if (code > 0x20 && code !== 0x7f) out += input[i];
  }
  return out;
}

export function decodeHtmlEntities(input: string): string {
  if (!input.includes('&')) return input;
  let out = '';
  for (let i = 0; i < input.length;) {
    if (input[i] !== '&') {
      out += input[i];
      i += 1;
      continue;
    }
    if (input[i + 1] === '#') {
      const hex = input[i + 2] === 'x' || input[i + 2] === 'X';
      let p = hex ? i + 3 : i + 2;
      const digitsStart = p;
      while (p < input.length) {
        const c = input.charCodeAt(p);
        const valid = hex
          ? (c >= 48 && c <= 57) || (c >= 65 && c <= 70) || (c >= 97 && c <= 102)
          : c >= 48 && c <= 57;
        if (!valid) break;
        p += 1;
      }
      if (p > digitsStart) {
        const cp = Number.parseInt(input.slice(digitsStart, p), hex ? 16 : 10);
        if (input[p] === ';') p += 1;
        out += sanitizeCodePoint(cp);
        i = p;
        continue;
      }
    } else {
      let p = i + 1;
      while (p < input.length && p - i <= 24) {
        if (!isAsciiAlphaNum(input.charCodeAt(p))) break;
        p += 1;
      }
      if (p > i + 1) {
        const key = input.slice(i + 1, p);
        if (input[p] === ';') {
          const mapped = NAMED_ENTITIES[key];
          if (mapped !== undefined) {
            out += mapped;
            i = p + 1;
            continue;
          }
        } else {
          const next = input[p];
          const blockedLegacyNext =
            next !== undefined && (next === '=' || isAsciiAlphaNum(next.charCodeAt(0)));
          const legacyMapped = !blockedLegacyNext ? LEGACY_UNTERMINATED_ENTITIES[key] : undefined;
          if (legacyMapped !== undefined) {
            out += legacyMapped;
            i = p;
            continue;
          }
        }
      }
    }
    out += '&';
    i += 1;
  }
  return out;
}
