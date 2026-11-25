// Bounded context: Non-executing Agensi creator HTML extractor (TSR two-query graph + linear semantic card fallback).
// Invariant: Zero eval/Function/vm, linear O(N) HTML scanners, bounded token/depth/card caps, canonical skill URLs.

import { extractSemanticHtmlFallback, scanTagBlocksLinear } from './agensi-html-cards.ts';
import {
  isTsrRefPlaceholder,
  MAX_TSR_DEPTH,
  MAX_TSR_TOKENS,
  parseTsrScriptBody,
  TsrLimitError,
} from './agensi-tsr-lexer.ts';

export { MAX_TSR_DEPTH, MAX_TSR_TOKENS };

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

interface ProfileEntry {
  readonly handle: string;
  readonly creatorId: string | null;
  readonly inlineSkills: readonly Record<string, unknown>[] | null;
}

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

function extractQueryStateData(
  record: Readonly<Record<string, unknown>>,
  refs: ReadonlyMap<number, unknown>,
): unknown {
  const state = resolveRef(record['state'], refs, new Set()) as Record<string, unknown> | undefined;
  if (state && typeof state === 'object' && 'data' in state) {
    return resolveRef(state['data'], refs, new Set());
  }
  if ('data' in record) {
    return resolveRef(record['data'], refs, new Set());
  }
  return record;
}

function normalizeSkillArray(
  rawSkills: readonly unknown[],
  refs: ReadonlyMap<number, unknown>,
): readonly Record<string, unknown>[] {
  return rawSkills
    .map(item => normalizeExtractedSkill(item, refs))
    .filter((item): item is Record<string, unknown> => item !== null);
}

function findCreatorProfileQuery(
  roots: readonly unknown[],
  refs: ReadonlyMap<number, unknown>,
  expectedCreator: string,
): { creatorHandle: string; skills: readonly Record<string, unknown>[] } | null {
  const visited = new WeakSet<object>();
  const profiles: ProfileEntry[] = [];
  const skillsByKey = new Map<string, readonly Record<string, unknown>[]>();

  const walk = (node: unknown, depth: number): void => {
    if (depth > MAX_TSR_DEPTH) return;
    const resolved = resolveRef(node, refs, new Set());
    if (!resolved || typeof resolved !== 'object' || visited.has(resolved)) return;
    visited.add(resolved);

    if (Array.isArray(resolved)) {
      for (const entry of resolved) walk(entry, depth + 1);
      return;
    }

    const record = resolved as Record<string, unknown>;
    const queryKey = resolveRef(record['queryKey'], refs, new Set());
    if (Array.isArray(queryKey) && typeof queryKey[1] === 'string') {
      const keyKind = queryKey[0];
      const keyArg = queryKey[1].trim();
      const data = extractQueryStateData(record, refs);

      if (
        keyKind === 'creator-profile' &&
        data &&
        typeof data === 'object' &&
        !Array.isArray(data)
      ) {
        const dataRec = data as Record<string, unknown>;
        const handle =
          (typeof dataRec['slug'] === 'string' && dataRec['slug'].trim()) ||
          (typeof dataRec['handle'] === 'string' && dataRec['handle'].trim()) ||
          keyArg;
        const rawCreatorId =
          (typeof dataRec['user_id'] === 'string' && dataRec['user_id'].trim()) ||
          (typeof dataRec['id'] === 'string' && dataRec['id'].trim()) ||
          null;
        const rawInline = resolveRef(dataRec['skills'], refs, new Set());
        profiles.push({
          handle,
          creatorId: rawCreatorId,
          inlineSkills: Array.isArray(rawInline) ? normalizeSkillArray(rawInline, refs) : null,
        });
      } else if (keyKind === 'creator-skills' && keyArg) {
        const rawList = Array.isArray(data)
          ? data
          : data && typeof data === 'object'
            ? resolveRef((data as Record<string, unknown>)['skills'], refs, new Set())
            : undefined;
        if (Array.isArray(rawList)) {
          skillsByKey.set(keyArg.toLowerCase(), normalizeSkillArray(rawList, refs));
        }
      }
    }

    for (const val of Object.values(record)) walk(val, depth + 1);
  };

  for (const root of roots) walk(root, 0);
  if (profiles.length === 0) return null;

  const normalizedExpected = expectedCreator.trim().toLowerCase();
  const matchedProfile =
    profiles.find(p => p.handle.toLowerCase() === normalizedExpected) ?? profiles[0];
  if (!matchedProfile) return null;

  if (matchedProfile.inlineSkills) {
    return { creatorHandle: matchedProfile.handle, skills: matchedProfile.inlineSkills };
  }

  const joined =
    (matchedProfile.creatorId
      ? skillsByKey.get(matchedProfile.creatorId.toLowerCase())
      : undefined) ?? skillsByKey.get(matchedProfile.handle.toLowerCase());
  if (!joined) return null;

  const expectedId = matchedProfile.creatorId?.toLowerCase() ?? null;
  const verifiedSkills = joined.filter(item => {
    const itemCreatorId =
      (typeof item['creator_id'] === 'string' && item['creator_id'].trim().toLowerCase()) ||
      (typeof item['creatorId'] === 'string' && item['creatorId'].trim().toLowerCase()) ||
      null;
    return !expectedId || !itemCreatorId || itemCreatorId === expectedId;
  });
  return { creatorHandle: matchedProfile.handle, skills: verifiedSkills };
}

/**
 * Parses an Agensi creator storefront HTML document using a strictly non-executing TSR stream
 * parser (supporting both inline and two-query `creator-profile` + `creator-skills` hydration) with
 * a linear O(N) bounded semantic HTML card fallback.
 */
export function parseAgensiCreatorHtml(
  html: string,
  options: ParseAgensiHtmlOptions,
): AgensiHtmlParseResult {
  try {
    const lowerHtml = html.toLowerCase();
    const scripts = scanTagBlocksLinear(html, lowerHtml, 'script')
      .filter(el => el.openTag.toLowerCase().includes('data-tsr-stream-part'))
      .map(el => el.body)
      .filter(Boolean);

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

    const fallbackItems = extractSemanticHtmlFallback(
      html,
      lowerHtml,
      options.creatorHandle,
      options.finalUrl,
    );
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
  } catch {
    return {
      ok: false,
      reason: 'html_parse_error',
      message: 'Agensi HTML response could not be parsed safely.',
    };
  }
}
