// Bounded context: Non-executing Agensi creator HTML extractor (TSR query graph + semantic card fallback).
// Invariant: Zero eval/Function/vm, bounded token/depth/card caps, canonical skill URL synthesis.

import {
  isTsrRefPlaceholder,
  MAX_TSR_DEPTH,
  MAX_TSR_TOKENS,
  parseTsrScriptBody,
  TsrLimitError,
} from './agensi-tsr-lexer.ts';

export { MAX_TSR_DEPTH, MAX_TSR_TOKENS };

const MAX_SEMANTIC_CARDS = 200;
const CANONICAL_SKILL_ORIGIN = 'https://agensi.io/skills/';

export type AgensiHtmlParseMode = 'tsr_stream' | 'html_fallback';

export interface ParseAgensiHtmlOptions {
  readonly creatorHandle: string;
  readonly finalUrl: string;
}

export type AgensiHtmlParseResult =
  | {
      readonly ok: true;
      readonly parseMode: AgensiHtmlParseMode;
      readonly creatorHandle: string;
      readonly items: readonly Record<string, unknown>[];
    }
  | {
      readonly ok: false;
      readonly reason: string;
      readonly message: string;
    };

function resolveRef(
  value: unknown,
  refs: ReadonlyMap<number, unknown>,
  seen: Set<number>,
): unknown {
  if (!isTsrRefPlaceholder(value)) return value;
  if (seen.has(value.__tsrRef)) return undefined;
  seen.add(value.__tsrRef);
  return resolveRef(refs.get(value.__tsrRef), refs, seen);
}

function normalizeExtractedSkill(
  raw: unknown,
  refs: ReadonlyMap<number, unknown>,
): Record<string, unknown> | null {
  const resolved = resolveRef(raw, refs, new Set());
  if (!resolved || typeof resolved !== 'object' || Array.isArray(resolved)) return null;
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(resolved as Record<string, unknown>)) {
    const resolvedVal = resolveRef(val, refs, new Set());
    out[key] = Array.isArray(resolvedVal)
      ? resolvedVal.map(el => resolveRef(el, refs, new Set()))
      : resolvedVal;
  }
  const slug = typeof out['slug'] === 'string' ? out['slug'].trim() : '';
  const rawUrl = typeof out['url'] === 'string' ? out['url'].trim() : '';
  if (slug && !rawUrl) {
    out['url'] = `${CANONICAL_SKILL_ORIGIN}${encodeURIComponent(slug)}`;
  }
  return out;
}

function findCreatorProfileQuery(
  roots: readonly unknown[],
  refs: ReadonlyMap<number, unknown>,
  expectedCreator: string,
): { creatorHandle: string; skills: readonly Record<string, unknown>[] } | null {
  const visited = new WeakSet<object>();
  const normalizedExpected = expectedCreator.trim().toLowerCase();
  let fallbackMatch: { creatorHandle: string; skills: readonly Record<string, unknown>[] } | null =
    null;

  const walk = (
    node: unknown,
    depth: number,
  ): { creatorHandle: string; skills: readonly Record<string, unknown>[] } | null => {
    if (depth > MAX_TSR_DEPTH) return null;
    const resolved = resolveRef(node, refs, new Set());
    if (!resolved || typeof resolved !== 'object' || visited.has(resolved)) return null;
    visited.add(resolved);

    if (Array.isArray(resolved)) {
      for (const entry of resolved) {
        const found = walk(entry, depth + 1);
        if (found) return found;
      }
      return null;
    }

    const record = resolved as Record<string, unknown>;
    const queryKey = resolveRef(record['queryKey'], refs, new Set());
    if (
      Array.isArray(queryKey) &&
      queryKey[0] === 'creator-profile' &&
      typeof queryKey[1] === 'string'
    ) {
      const state = resolveRef(record['state'], refs, new Set()) as
        | Record<string, unknown>
        | undefined;
      const data =
        (state && typeof state === 'object'
          ? (resolveRef(state['data'], refs, new Set()) as Record<string, unknown> | undefined)
          : undefined) ??
        (resolveRef(record['data'], refs, new Set()) as Record<string, unknown> | undefined) ??
        record;
      const rawSkills =
        data && typeof data === 'object' ? resolveRef(data['skills'], refs, new Set()) : undefined;
      if (Array.isArray(rawSkills)) {
        const handle =
          (typeof data?.['slug'] === 'string' && data['slug'].trim()) ||
          (typeof data?.['handle'] === 'string' && data['handle'].trim()) ||
          queryKey[1].trim();
        const skills = rawSkills
          .map(item => normalizeExtractedSkill(item, refs))
          .filter((item): item is Record<string, unknown> => item !== null);
        const match = { creatorHandle: handle, skills };
        if (handle.toLowerCase() === normalizedExpected) return match;
        fallbackMatch ??= match;
      }
    }

    for (const val of Object.values(record)) {
      const found = walk(val, depth + 1);
      if (found) return found;
    }
    return null;
  };

  for (const root of roots) {
    const found = walk(root, 0);
    if (found) return found;
  }
  return fallbackMatch;
}

function decodeHtmlEntities(input: string): string {
  return input
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&apos;', "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_match, hex: string) => {
      const cp = Number.parseInt(hex, 16);
      return Number.isFinite(cp) ? String.fromCodePoint(cp) : '';
    })
    .replace(/&#(\d+);/g, (_match, dec: string) => {
      const cp = Number.parseInt(dec, 10);
      return Number.isFinite(cp) ? String.fromCodePoint(cp) : '';
    });
}

function extractSemanticHtmlFallback(
  html: string,
  options: ParseAgensiHtmlOptions,
): readonly Record<string, unknown>[] {
  try {
    const normalizedPath = new URL(options.finalUrl).pathname.replace(/\/+$/, '').toLowerCase();
    const rawExpected = `/creators/${options.creatorHandle.trim().toLowerCase()}`;
    const encExpected = `/creators/${encodeURIComponent(options.creatorHandle.trim()).toLowerCase()}`;
    if (normalizedPath !== rawExpected && normalizedPath !== encExpected) return [];
  } catch {
    return [];
  }

  const items: Record<string, unknown>[] = [];
  const seenSlugs = new Set<string>();
  const anchorPattern = /<a\b[^>]*\bhref=["']\/skills\/([^"'/?#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = anchorPattern.exec(html)) !== null && items.length < MAX_SEMANTIC_CARDS) {
    const slug = (match[1] ?? '').trim();
    const body = match[2] ?? '';
    if (!slug || seenSlugs.has(slug)) continue;
    const h3Match = /<h3\b[^>]*>([\s\S]*?)<\/h3>/i.exec(body);
    const pMatch = /<p\b[^>]*>([\s\S]*?)<\/p>/i.exec(body);
    if (!h3Match?.[1] || !pMatch?.[1]) continue;
    const name = decodeHtmlEntities(h3Match[1].replace(/<[^>]*>/g, ''))
      .replace(/\s+/g, ' ')
      .trim();
    const summary = decodeHtmlEntities(pMatch[1].replace(/<[^>]*>/g, ''))
      .replace(/\s+/g, ' ')
      .trim();
    if (!name || !summary) continue;

    seenSlugs.add(slug);
    items.push({
      slug,
      name,
      summary,
      tags: [],
      url: `${CANONICAL_SKILL_ORIGIN}${encodeURIComponent(slug)}`,
      status: 'live',
      sortOrder: items.length + 1,
    });
  }
  return items;
}

/**
 * Parses an Agensi creator storefront HTML document using a strictly non-executing TSR stream
 * parser with a bounded semantic HTML card fallback.
 */
export function parseAgensiCreatorHtml(
  html: string,
  options: ParseAgensiHtmlOptions,
): AgensiHtmlParseResult {
  const scripts: string[] = [];
  const scriptPattern = /<script\b[^>]*\bdata-tsr-stream-part\b[^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = scriptPattern.exec(html)) !== null) {
    if (match[1]) scripts.push(match[1]);
  }

  if (scripts.length > 0) {
    const refs = new Map<number, unknown>();
    const roots: unknown[] = [];
    try {
      for (const scriptBody of scripts) {
        roots.push(...parseTsrScriptBody(scriptBody, refs));
      }
    } catch (error) {
      if (error instanceof TsrLimitError) {
        return { ok: false, reason: error.reason, message: error.message };
      }
      return {
        ok: false,
        reason: 'tsr_parse_error',
        message: 'Agensi TSR stream payload could not be parsed.',
      };
    }
    const found = findCreatorProfileQuery(
      [...roots, ...refs.values()],
      refs,
      options.creatorHandle,
    );
    if (found) {
      return {
        ok: true,
        parseMode: 'tsr_stream',
        creatorHandle: found.creatorHandle,
        items: found.skills,
      };
    }
  }

  const fallbackItems = extractSemanticHtmlFallback(html, options);
  if (fallbackItems.length > 0) {
    return {
      ok: true,
      parseMode: 'html_fallback',
      creatorHandle: options.creatorHandle,
      items: fallbackItems,
    };
  }
  return {
    ok: false,
    reason: 'no_creator_skills_found',
    message: 'Agensi HTML response did not contain creator profile skills.',
  };
}
