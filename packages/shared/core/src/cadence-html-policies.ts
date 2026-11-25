import {
  decodeHtmlEntities,
  escapeCadenceHtml,
  escapeTagAngleBrackets,
  isAsciiAlpha,
  isAsciiSpace,
  isEndTagBoundary,
  isValidIdentifierName,
  sanitizeCodePoint,
  startsWithIgnoreCase,
  stripAsciiControlsAndSpace,
} from './cadence-html-entities.ts';

export {
  decodeHtmlEntities,
  escapeCadenceHtml,
  escapeTagAngleBrackets,
  isAsciiAlpha,
  isAsciiSpace,
  isEndTagBoundary,
  isValidIdentifierName,
  startsWithIgnoreCase,
};

export const MAX_CADENCE_ARTIFACT_BYTES = 48 * 1024;

export const CANONICAL_PROBE_SCRIPT =
  "(function(){var c=0,b=document.getElementById('ping-btn'),o=document.getElementById('probe-val');if(b&&o){var p=o.getAttribute('data-probe-prefix')||o.textContent||'probe';b.addEventListener('click',function(){c+=1;o.textContent=p+' #'+c;});}})();";

export const STRICT_SANDBOX_CSP_META =
  "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; style-src 'unsafe-inline'; script-src 'sha256-B0vaSeHTnSWoVee69pbJTQb3o4Bao8IjCqTjjpMMNhc='; base-uri 'none'; form-action 'none';\" />";

export const BLOCKED_RAWTEXT_TAGS = new Set(['iframe', 'noembed', 'noframes', 'noscript', 'xmp']);
export const BLOCKED_NESTABLE_TAGS = new Set([
  'object',
  'applet',
  'foreignobject',
  'template',
  'svg',
  'math',
]);
export const BLOCKED_SINGLE_TAGS = new Set(
  'embed base link frame frameset portal plaintext isindex set animate animatemotion animatetransform mpath handler listener'.split(
    ' ',
  ),
);
export const RAWTEXT_RCDATA_SAFE_TAGS = new Set(['style', 'title', 'textarea']);
export const UNSAFE_CLOSE_TAGS = new Set([
  ...BLOCKED_RAWTEXT_TAGS,
  ...BLOCKED_NESTABLE_TAGS,
  ...BLOCKED_SINGLE_TAGS,
  ...RAWTEXT_RCDATA_SAFE_TAGS,
  'script',
]);
export const HTML_VOID_TAGS = new Set(
  'area base basefont bgsound br col embed frame hr img input keygen link meta param source track wbr'.split(
    ' ',
  ),
);

const URI_ATTRS = new Set(
  'href xlink:href src action formaction data poster background cite codebase longdesc manifest profile usemap'.split(
    ' ',
  ),
);
const URI_LIST_ATTRS = new Set(['srcset', 'imagesrcset']);

export interface ParsedAttr {
  readonly name: string;
  readonly hasValue: boolean;
  readonly value: string;
}

export interface ParsedTag {
  readonly tagName: string;
  readonly attrs: readonly ParsedAttr[];
  readonly selfClosing: boolean;
  readonly endIndex: number;
  readonly closed: boolean;
}

export function isAllowedUri(rawValue: string): boolean {
  const norm = stripAsciiControlsAndSpace(decodeHtmlEntities(rawValue));
  if (!norm || norm.startsWith('#')) return true;
  if (norm.startsWith('/')) return norm.length === 1 || (norm[1] !== '/' && norm[1] !== '\\');
  const lower = norm.toLowerCase();
  if (lower.startsWith('https://') || lower.startsWith('http://')) return true;
  if (norm.startsWith('\\')) return false;
  for (let i = 0; i < norm.length; i += 1) {
    const ch = norm[i];
    if (ch === '/' || ch === '?' || ch === '#') return true;
    if (ch === ':' || ch === '\\') return false;
  }
  return true;
}

function isAllowedSrcset(decodedValue: string): boolean {
  for (const part of decodedValue.split(',')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    let urlEnd = 0;
    while (urlEnd < trimmed.length && !isAsciiSpace(trimmed[urlEnd]!)) urlEnd += 1;
    if (!isAllowedUri(trimmed.slice(0, urlEnd))) return false;
  }
  return true;
}

export function hasUnsafeCss(rawCss: string): boolean {
  const src = rawCss.replaceAll('\r\n', '\n').replaceAll('\r', '\n').replaceAll('\f', '\n');
  let decoded = '';
  let quote = '';
  for (let i = 0; i < src.length;) {
    const ch = src[i]!;
    if (!quote && ch === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2);
      i = end === -1 ? src.length : end + 2;
      continue;
    }
    if (!quote && (ch === '"' || ch === "'")) {
      quote = ch;
      decoded += ch;
      i += 1;
      continue;
    }
    if (quote && (ch === quote || ch === '\n')) {
      quote = '';
      decoded += ch;
      i += 1;
      continue;
    }
    if (ch !== '\\' || i + 1 >= src.length) {
      decoded += ch;
      i += 1;
      continue;
    }
    let p = i + 1;
    while (p < src.length && p - (i + 1) < 6) {
      const c = src.charCodeAt(p);
      if (!((c >= 48 && c <= 57) || (c >= 65 && c <= 70) || (c >= 97 && c <= 102))) break;
      p += 1;
    }
    if (p > i + 1) {
      const cp = Number.parseInt(src.slice(i + 1, p), 16);
      if (p < src.length && isAsciiSpace(src[p]!)) p += 1;
      decoded += sanitizeCodePoint(cp);
      i = p;
      continue;
    }
    decoded += src[i + 1];
    i += 2;
  }
  const compact = stripAsciiControlsAndSpace(decoded).toLowerCase();
  return (
    compact.includes('@import') ||
    compact.includes('expression(') ||
    compact.includes('javascript:') ||
    compact.includes('vbscript:') ||
    compact.includes('data:') ||
    compact.includes('-moz-binding') ||
    compact.includes('behavior:')
  );
}

export function parseHtmlTag(src: string, start: number, isClose: boolean): ParsedTag {
  const n = src.length;
  let p = isClose ? start + 2 : start + 1;
  const nameStart = p;
  while (p < n && !isAsciiSpace(src[p]!) && src[p] !== '/' && src[p] !== '>') p += 1;
  const tagName = src.slice(nameStart, p).toLowerCase();
  const attrs: ParsedAttr[] = [];

  while (p < n) {
    while (p < n && isAsciiSpace(src[p]!)) p += 1;
    if (p >= n) return { tagName, attrs, selfClosing: false, endIndex: n, closed: false };
    if (src[p] === '>')
      return { tagName, attrs, selfClosing: false, endIndex: p + 1, closed: true };
    if (src[p] === '/') {
      if (src[p + 1] === '>')
        return { tagName, attrs, selfClosing: true, endIndex: p + 2, closed: true };
      p += 1;
      continue;
    }
    const attrStart = p;
    while (p < n && !isAsciiSpace(src[p]!) && src[p] !== '=' && src[p] !== '/' && src[p] !== '>')
      p += 1;
    const name = src.slice(attrStart, p).toLowerCase();
    while (p < n && isAsciiSpace(src[p]!)) p += 1;

    let hasValue = false;
    let value = '';
    if (p < n && src[p] === '=') {
      hasValue = true;
      p += 1;
      while (p < n && isAsciiSpace(src[p]!)) p += 1;
      if (p < n && (src[p] === '"' || src[p] === "'")) {
        const quote = src[p]!;
        p += 1;
        const valStart = p;
        while (p < n && src[p] !== quote) p += 1;
        value = src.slice(valStart, p);
        if (p < n && src[p] === quote) p += 1;
      } else {
        const valStart = p;
        while (p < n && !isAsciiSpace(src[p]!) && src[p] !== '>') p += 1;
        value = src.slice(valStart, p);
      }
    }
    if (name) attrs.push({ name, hasValue, value });
  }
  return { tagName, attrs, selfClosing: false, endIndex: n, closed: false };
}

export function serializeSanitizedOpenTag(
  tag: ParsedTag,
  honorSelfClosing: boolean,
  onStripped: () => void,
): { html: string; hasHttpEquiv: boolean } {
  const seen = new Set<string>();
  const kept: string[] = [];
  let hasHttpEquiv = false;

  for (const attr of tag.attrs) {
    const name = attr.name;
    if (name === 'http-equiv') hasHttpEquiv = true;
    const isEventHandler = name.length > 2 && name.startsWith('on') && isAsciiAlpha(name[2]!);
    if (
      isEventHandler ||
      name === 'srcdoc' ||
      name === 'ping' ||
      !isValidIdentifierName(name, true)
    ) {
      onStripped();
      continue;
    }
    if (!attr.hasValue) {
      if (!seen.has(name)) {
        seen.add(name);
        kept.push(name);
      }
      continue;
    }
    let decoded = decodeHtmlEntities(attr.value);
    let dropAttr = false;
    if (URI_ATTRS.has(name) && !isAllowedUri(attr.value)) {
      decoded = '#blocked';
      onStripped();
    } else if (URI_LIST_ATTRS.has(name) && !isAllowedSrcset(decoded)) {
      onStripped();
      dropAttr = true;
    } else if (name === 'style' && hasUnsafeCss(decoded)) {
      onStripped();
      dropAttr = true;
    }
    if (seen.has(name) || dropAttr) continue;
    seen.add(name);
    kept.push(`${name}="${escapeCadenceHtml(decoded)}"`);
  }

  const attrPart = kept.length > 0 ? ` ${kept.join(' ')}` : '';
  const suffix = honorSelfClosing && tag.selfClosing ? ' />' : '>';
  return { html: `<${tag.tagName}${attrPart}${suffix}`, hasHttpEquiv };
}
