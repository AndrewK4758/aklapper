// Bounded context: Linear O(N) HTML tag scanner, single-pass entity decoder, and semantic card fallback.
// Invariant: Zero backtracking regexes; safe single-pass entity decoding; bounded card cap.

const MAX_SEMANTIC_CARDS = 200;
const CANONICAL_SKILL_ORIGIN = 'https://agensi.io/skills/';

const NAMED_HTML_ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

export interface ScannedElement {
  readonly openTag: string;
  readonly body: string;
}

export function decodeHtmlEntities(input: string): string {
  return input.replace(
    /&(?:([a-zA-Z]+)|#([0-9]{1,8})|#x([0-9a-fA-F]{1,8}));/g,
    (match, named?: string, dec?: string, hex?: string) => {
      if (named) {
        return NAMED_HTML_ENTITIES[named.toLowerCase()] ?? match;
      }
      const cp = dec ? Number.parseInt(dec, 10) : hex ? Number.parseInt(hex, 16) : NaN;
      return Number.isInteger(cp) && cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : '';
    },
  );
}

function stripTagsLinear(rawHtml: string): string {
  let out = '';
  let inTag = false;
  for (let i = 0; i < rawHtml.length; i += 1) {
    const ch = rawHtml[i] ?? '';
    if (ch === '<') inTag = true;
    else if (ch === '>') inTag = false;
    else if (!inTag) out += ch;
  }
  return decodeHtmlEntities(out).replace(/\s+/g, ' ').trim();
}

export function scanTagBlocksLinear(
  html: string,
  lowerHtml: string,
  tagName: string,
): ScannedElement[] {
  const results: ScannedElement[] = [];
  const openPrefix = `<${tagName}`;
  const closeToken = `</${tagName}>`;
  let cursor = 0;

  while (cursor < lowerHtml.length) {
    const start = lowerHtml.indexOf(openPrefix, cursor);
    if (start === -1) break;
    const afterName = lowerHtml[start + openPrefix.length] ?? '';
    if (
      afterName !== '>' &&
      afterName !== ' ' &&
      afterName !== '\t' &&
      afterName !== '\n' &&
      afterName !== '\r' &&
      afterName !== '/'
    ) {
      cursor = start + openPrefix.length;
      continue;
    }
    const openEnd = lowerHtml.indexOf('>', start + openPrefix.length);
    if (openEnd === -1) break;
    const closeStart = lowerHtml.indexOf(closeToken, openEnd + 1);
    if (closeStart === -1) break;
    results.push({
      openTag: html.slice(start, openEnd + 1),
      body: html.slice(openEnd + 1, closeStart),
    });
    cursor = closeStart + closeToken.length;
  }
  return results;
}

function extractSkillSlugFromSlice(slice: string): string | null {
  const lower = slice.toLowerCase();
  const markers = ['href="/skills/', "href='/skills/"];
  for (const marker of markers) {
    const idx = lower.indexOf(marker);
    if (idx === -1) continue;
    const quote = marker[5] ?? '"';
    const valueStart = idx + marker.length;
    const valueEnd = slice.indexOf(quote, valueStart);
    if (valueEnd === -1) continue;
    const raw = slice.slice(valueStart, valueEnd).split(/[/?#]/)[0]?.trim() ?? '';
    if (raw) return raw;
  }
  return null;
}

function extractCardFromContainer(
  slug: string,
  body: string,
  seenSlugs: Set<string>,
  sortOrder: number,
): Record<string, unknown> | null {
  if (!slug || seenSlugs.has(slug)) return null;
  const lowerBody = body.toLowerCase();
  const h3Blocks = scanTagBlocksLinear(body, lowerBody, 'h3');
  const pBlocks = scanTagBlocksLinear(body, lowerBody, 'p');
  const name = h3Blocks[0] ? stripTagsLinear(h3Blocks[0].body) : '';
  if (!name) return null;

  let summary = '';
  for (const pBlock of pBlocks) {
    const candidate = stripTagsLinear(pBlock.body);
    if (candidate && !/^by\s+/i.test(candidate)) {
      summary = candidate;
      break;
    }
  }
  if (!summary) return null;

  seenSlugs.add(slug);
  return {
    slug,
    name,
    summary,
    tags: [],
    url: `${CANONICAL_SKILL_ORIGIN}${encodeURIComponent(slug)}`,
    status: 'live',
    sortOrder,
  };
}

export function extractSemanticHtmlFallback(
  html: string,
  lowerHtml: string,
  creatorHandle: string,
  finalUrl: string,
): readonly Record<string, unknown>[] {
  try {
    const normalizedPath = new URL(finalUrl).pathname.replace(/\/+$/, '').toLowerCase();
    const rawExpected = `/creators/${creatorHandle.trim().toLowerCase()}`;
    const encExpected = `/creators/${encodeURIComponent(creatorHandle.trim()).toLowerCase()}`;
    if (normalizedPath !== rawExpected && normalizedPath !== encExpected) return [];
  } catch {
    return [];
  }

  const items: Record<string, unknown>[] = [];
  const seenSlugs = new Set<string>();

  for (const article of scanTagBlocksLinear(html, lowerHtml, 'article')) {
    if (items.length >= MAX_SEMANTIC_CARDS) break;
    const slug = extractSkillSlugFromSlice(article.body);
    if (!slug) continue;
    const card = extractCardFromContainer(slug, article.body, seenSlugs, items.length + 1);
    if (card) items.push(card);
  }

  if (items.length === 0) {
    for (const anchor of scanTagBlocksLinear(html, lowerHtml, 'a')) {
      if (items.length >= MAX_SEMANTIC_CARDS) break;
      const slug = extractSkillSlugFromSlice(anchor.openTag);
      if (!slug) continue;
      const card = extractCardFromContainer(slug, anchor.body, seenSlugs, items.length + 1);
      if (card) items.push(card);
    }
  }

  return items;
}
