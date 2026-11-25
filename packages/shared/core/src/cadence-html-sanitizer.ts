import {
  BLOCKED_NESTABLE_TAGS,
  BLOCKED_RAWTEXT_TAGS,
  BLOCKED_SINGLE_TAGS,
  CANONICAL_PROBE_SCRIPT,
  HTML_VOID_TAGS,
  MAX_CADENCE_ARTIFACT_BYTES,
  RAWTEXT_RCDATA_SAFE_TAGS,
  STRICT_SANDBOX_CSP_META,
  UNSAFE_CLOSE_TAGS,
  escapeCadenceHtml,
  escapeTagAngleBrackets,
  hasUnsafeCss,
  isAsciiAlpha,
  isAsciiSpace,
  isEndTagBoundary,
  isValidIdentifierName,
  parseHtmlTag,
  serializeSanitizedOpenTag,
  startsWithIgnoreCase,
} from './cadence-html-policies.ts';

export {
  CANONICAL_PROBE_SCRIPT,
  MAX_CADENCE_ARTIFACT_BYTES,
  STRICT_SANDBOX_CSP_META,
  escapeCadenceHtml,
};

export interface SanitizedCadenceArtifact {
  readonly html: string;
  readonly stripped: boolean;
}

const MARKDOWN_FENCE_RE = /^\s*```(?:html)?\s*\n?([\s\S]*?)\s*```\s*$/i;

function scanRawOrRcdataEnd(
  src: string,
  bodyStart: number,
  tagName: string,
): { body: string; endIndex: number; found: boolean } {
  const needle = `</${tagName}`;
  for (let p = bodyStart; p < src.length; p += 1) {
    if (startsWithIgnoreCase(src, p, needle) && isEndTagBoundary(src[p + needle.length])) {
      const closeTag = parseHtmlTag(src, p, true);
      return { body: src.slice(bodyStart, p), endIndex: closeTag.endIndex, found: closeTag.closed };
    }
  }
  return { body: src.slice(bodyStart), endIndex: src.length, found: false };
}

function scanScriptBodyEnd(
  src: string,
  bodyStart: number,
): { body: string; endIndex: number; found: boolean } {
  let escaped = false;
  let doubleEscaped = false;
  for (let p = bodyStart; p < src.length;) {
    if (!escaped) {
      if (src.startsWith('<!--', p)) {
        escaped = true;
        p += 2;
        continue;
      }
      if (startsWithIgnoreCase(src, p, '</script') && isEndTagBoundary(src[p + 8])) {
        const closeTag = parseHtmlTag(src, p, true);
        return {
          body: src.slice(bodyStart, p),
          endIndex: closeTag.endIndex,
          found: closeTag.closed,
        };
      }
    } else if (src.startsWith('-->', p)) {
      escaped = false;
      doubleEscaped = false;
      p += 3;
      continue;
    } else if (!doubleEscaped) {
      if (startsWithIgnoreCase(src, p, '<script') && isEndTagBoundary(src[p + 7])) {
        doubleEscaped = true;
        p += 7;
        continue;
      }
      if (startsWithIgnoreCase(src, p, '</script') && isEndTagBoundary(src[p + 8])) {
        const closeTag = parseHtmlTag(src, p, true);
        return {
          body: src.slice(bodyStart, p),
          endIndex: closeTag.endIndex,
          found: closeTag.closed,
        };
      }
    } else if (startsWithIgnoreCase(src, p, '</script') && isEndTagBoundary(src[p + 8])) {
      doubleEscaped = false;
      p += 8;
      continue;
    }
    p += 1;
  }
  return { body: src.slice(bodyStart), endIndex: src.length, found: false };
}

function findCommentEnd(src: string, start: number): number {
  if (src.startsWith('<!-->', start)) return start + 5;
  if (src.startsWith('<!--->', start)) return start + 6;
  for (let p = start + 4; p < src.length; p += 1) {
    if (src.startsWith('-->', p)) return p + 3;
    if (src.startsWith('--!>', p)) return p + 4;
  }
  return src.length;
}

function skipNestableContainer(src: string, bodyStart: number, tagName: string): number {
  const openNeedle = `<${tagName}`;
  const closeNeedle = `</${tagName}`;
  let depth = 1;
  for (let p = bodyStart; p < src.length;) {
    if (src[p] !== '<') {
      p += 1;
      continue;
    }
    if (src.startsWith('<!--', p)) {
      p = findCommentEnd(src, p);
      continue;
    }
    if (
      startsWithIgnoreCase(src, p, closeNeedle) &&
      isEndTagBoundary(src[p + closeNeedle.length])
    ) {
      p = parseHtmlTag(src, p, true).endIndex;
      depth -= 1;
      if (depth === 0) return p;
      continue;
    }
    if (startsWithIgnoreCase(src, p, openNeedle) && isEndTagBoundary(src[p + openNeedle.length])) {
      const tag = parseHtmlTag(src, p, false);
      p = tag.endIndex;
      if (!tag.selfClosing || (tagName !== 'svg' && tagName !== 'math')) depth += 1;
      continue;
    }
    if (
      p + 1 < src.length &&
      (isAsciiAlpha(src[p + 1]!) ||
        (src[p + 1] === '/' && p + 2 < src.length && isAsciiAlpha(src[p + 2]!)))
    ) {
      p = parseHtmlTag(src, p, src[p + 1] === '/').endIndex;
      continue;
    }
    p += 1;
  }
  return src.length;
}

function findPreambleInsertPos(trimmed: string): number {
  let p = 0;
  while (p < trimmed.length && isAsciiSpace(trimmed[p]!)) p += 1;
  let doctypeEnd = 0;
  if (startsWithIgnoreCase(trimmed, p, '<!doctype') && isEndTagBoundary(trimmed[p + 9])) {
    const gt = trimmed.indexOf('>', p + 9);
    if (gt !== -1 && gt + 1 <= 256) {
      doctypeEnd = gt + 1;
      p = doctypeEnd;
      while (p < trimmed.length && isAsciiSpace(trimmed[p]!)) p += 1;
    }
  }
  if (startsWithIgnoreCase(trimmed, p, '<html') && isEndTagBoundary(trimmed[p + 5])) {
    const htmlTag = parseHtmlTag(trimmed, p, false);
    if (htmlTag.closed && htmlTag.endIndex <= 1024) {
      p = htmlTag.endIndex;
      while (p < trimmed.length && isAsciiSpace(trimmed[p]!)) p += 1;
    }
  }
  if (startsWithIgnoreCase(trimmed, p, '<head') && isEndTagBoundary(trimmed[p + 5])) {
    const headTag = parseHtmlTag(trimmed, p, false);
    if (headTag.closed && headTag.endIndex <= 2048) return headTag.endIndex;
  }
  return doctypeEnd;
}

function truncateUtf8ToBytes(
  value: string,
  maxBytes: number,
): { text: string; truncated: boolean } {
  const encoder = new TextEncoder();
  if (encoder.encode(value).byteLength <= maxBytes) return { text: value, truncated: false };
  let low = 0;
  let high = value.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (encoder.encode(value.slice(0, mid)).byteLength <= maxBytes) low = mid;
    else high = mid - 1;
  }
  let end = low;
  if (end > 0) {
    const code = value.charCodeAt(end - 1);
    if (code >= 0xd800 && code <= 0xdbff) end -= 1;
  }
  return { text: value.slice(0, end), truncated: true };
}

function finalizeWithStrictCspAndCap(html: string): { html: string; truncated: boolean } {
  const trimmed = html.trim();
  if (!trimmed) return { html: STRICT_SANDBOX_CSP_META, truncated: false };
  const encoder = new TextEncoder();
  const insertPos = findPreambleInsertPos(trimmed);
  const cspOverhead = encoder.encode(STRICT_SANDBOX_CSP_META).byteLength + 1;
  const capped = truncateUtf8ToBytes(trimmed, MAX_CADENCE_ARTIFACT_BYTES - cspOverhead);
  const safeInsert = Math.min(insertPos, capped.text.length);
  const withCsp =
    safeInsert > 0
      ? `${capped.text.slice(0, safeInsert)}\n${STRICT_SANDBOX_CSP_META}${capped.text.slice(safeInsert)}`
      : `${STRICT_SANDBOX_CSP_META}\n${capped.text}`;
  return { html: withCsp, truncated: capped.truncated };
}

export function sanitizeCadenceArtifactHtml(raw: string): SanitizedCadenceArtifact {
  let src = raw.trim();
  const fenceMatch = MARKDOWN_FENCE_RE.exec(src);
  if (fenceMatch && typeof fenceMatch[1] === 'string') src = fenceMatch[1].trim();

  let stripped = false;
  const markStripped = () => {
    stripped = true;
  };
  if (src.includes('\0')) {
    src = src.replaceAll('\0', '\uFFFD');
    stripped = true;
  }

  let out = '';
  for (let i = 0; i < src.length;) {
    const nextLt = src.indexOf('<', i);
    const textChunk = nextLt === -1 ? src.slice(i) : src.slice(i, nextLt);
    if (textChunk) out += textChunk;
    if (nextLt === -1) break;
    i = nextLt;

    if (src.startsWith('<!--', i)) {
      stripped = true;
      i = findCommentEnd(src, i);
      continue;
    }
    if (startsWithIgnoreCase(src, i, '<!doctype') && isEndTagBoundary(src[i + 9])) {
      const gt = src.indexOf('>', i + 9);
      if (gt === -1) {
        stripped = true;
        break;
      }
      out += src.slice(i, gt + 1);
      i = gt + 1;
      continue;
    }
    if (src[i + 1] === '!' || src[i + 1] === '?') {
      const gt = src.indexOf('>', i + 2);
      stripped = true;
      i = gt === -1 ? src.length : gt + 1;
      continue;
    }
    if (src[i + 1] === '/') {
      if (i + 2 >= src.length || !isAsciiAlpha(src[i + 2]!)) {
        const gt = src.indexOf('>', i + 2);
        stripped = true;
        i = gt === -1 ? src.length : gt + 1;
        continue;
      }
      const closeTag = parseHtmlTag(src, i, true);
      i = closeTag.endIndex;
      if (
        !closeTag.closed ||
        !isValidIdentifierName(closeTag.tagName, false) ||
        UNSAFE_CLOSE_TAGS.has(closeTag.tagName)
      ) {
        stripped = true;
        continue;
      }
      out += `</${closeTag.tagName}>`;
      continue;
    }
    if (i + 1 >= src.length || !isAsciiAlpha(src[i + 1]!)) {
      out += '&lt;';
      i += 1;
      continue;
    }

    const openTag = parseHtmlTag(src, i, false);
    const rawSlice = src.slice(i, openTag.endIndex);
    i = openTag.endIndex;
    if (!openTag.closed || !isValidIdentifierName(openTag.tagName, false)) {
      stripped = true;
      continue;
    }

    const tagName = openTag.tagName;
    if (tagName === 'script') {
      const scanned = scanScriptBodyEnd(src, i);
      i = scanned.endIndex;
      if (
        scanned.found &&
        !openTag.selfClosing &&
        openTag.attrs.length === 0 &&
        scanned.body === CANONICAL_PROBE_SCRIPT
      ) {
        out += `<script>${CANONICAL_PROBE_SCRIPT}</script>`;
      } else {
        stripped = true;
      }
      continue;
    }
    if (BLOCKED_RAWTEXT_TAGS.has(tagName)) {
      stripped = true;
      i = scanRawOrRcdataEnd(src, i, tagName).endIndex;
      continue;
    }
    if (BLOCKED_NESTABLE_TAGS.has(tagName)) {
      stripped = true;
      if (!openTag.selfClosing || (tagName !== 'svg' && tagName !== 'math')) {
        i = skipNestableContainer(src, i, tagName);
      }
      continue;
    }
    if (BLOCKED_SINGLE_TAGS.has(tagName)) {
      stripped = true;
      continue;
    }
    if (RAWTEXT_RCDATA_SAFE_TAGS.has(tagName)) {
      const serialized = serializeSanitizedOpenTag(openTag, false, markStripped);
      const scanned = scanRawOrRcdataEnd(src, i, tagName);
      i = scanned.endIndex;
      if (!scanned.found) {
        stripped = true;
        continue;
      }
      if (tagName === 'style') {
        if (
          scanned.body.includes('<') ||
          scanned.body.includes('-->') ||
          hasUnsafeCss(scanned.body)
        ) {
          stripped = true;
          continue;
        }
        out += `${serialized.html}${scanned.body}</style>`;
      } else {
        if (scanned.body.includes('<')) stripped = true;
        out += `${serialized.html}${escapeTagAngleBrackets(scanned.body)}</${tagName}>`;
      }
      continue;
    }

    const serialized = serializeSanitizedOpenTag(
      openTag,
      HTML_VOID_TAGS.has(tagName),
      markStripped,
    );
    if (tagName === 'meta' && serialized.hasHttpEquiv) {
      if (rawSlice.trim() === STRICT_SANDBOX_CSP_META) {
        if (out.endsWith('\n')) out = out.slice(0, -1);
      } else {
        stripped = true;
      }
      continue;
    }
    out += serialized.html;
  }

  const finalized = finalizeWithStrictCspAndCap(out);
  if (finalized.truncated) stripped = true;
  return { html: finalized.html, stripped };
}
