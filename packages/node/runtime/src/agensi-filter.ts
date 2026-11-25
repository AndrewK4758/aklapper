// Bounded context: External Agensi config resolution and strict creator/publish trust filtering.
// Invariant: Only published items belonging to the canonical creator with trusted origins pass validation.

import {
  type AgensiRemoteCreatorRef,
  type AgensiRemoteSkillItem,
  AgensiRemoteSkillItemSchema,
  type AgensiSkill,
  AgensiSkillSchema,
} from '@aklapper/core';

export const DEFAULT_AGENSI_CREATOR_HANDLE = 'aklapper';
export const DEFAULT_AGENSI_CACHE_TTL_SECONDS = 300;
export const DEFAULT_AGENSI_FETCH_TIMEOUT_MS = 1_800;
export const MIN_AGENSI_FETCH_TIMEOUT_MS = 250;
export const MAX_AGENSI_FETCH_TIMEOUT_MS = 2_000;
export const MAX_AGENSI_PAGES = 10;
export const DEFAULT_AGENSI_ALLOWED_ORIGINS: readonly string[] = [
  'https://agensi.io',
  'https://www.agensi.io',
];

export interface AgensiCatalogAdapterConfig {
  readonly baseUrl: string;
  readonly apiPath: string;
  readonly creatorHandle: string;
  readonly apiKey?: string;
  readonly timeoutMs: number;
  readonly maxPages: number;
  readonly allowedOrigins: readonly string[];
}

export interface ResolvedAgensiCatalogConfig {
  readonly baseUrl: string | null;
  readonly apiPath: string;
  readonly creatorHandle: string;
  readonly apiKey?: string;
  readonly ttlSeconds: number;
  readonly timeoutMs: number;
  readonly maxPages: number;
  readonly allowedOrigins: readonly string[];
}

export interface FilterCreatorPublishedSkillsResult {
  readonly items: readonly AgensiSkill[];
  readonly rejectedForeignCount: number;
  readonly rejectedUnpublishedCount: number;
  readonly rejectedInvalidCount: number;
}

export interface FilterCreatorPublishedSkillsContext {
  readonly envelopeCreatorHandle?: string | null;
  readonly isCreatorProfileSkills?: boolean;
  readonly fetchedAt?: Date;
  readonly correlationId?: string;
  readonly sortOffset?: number;
  readonly seenSlugs?: Set<string>;
}

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);

export function emitAgensiSeamLog(
  seamType: 'UNSOUND_CONDITION' | 'BOUNDARY_FAULT',
  event: string,
  detail: Readonly<Record<string, unknown>>,
): void {
  console.warn(
    JSON.stringify({
      seam_type: seamType,
      event,
      ...detail,
    }),
  );
}

/**
 * Clamps Agensi HTTP request latency within `[250, 2_000]` ms so streaming SSR deadlines never
 * stall.
 */
export function clampAgensiFetchTimeoutMs(rawMs?: number): number {
  if (rawMs === undefined || !Number.isFinite(rawMs)) {
    return DEFAULT_AGENSI_FETCH_TIMEOUT_MS;
  }
  return Math.max(
    MIN_AGENSI_FETCH_TIMEOUT_MS,
    Math.min(MAX_AGENSI_FETCH_TIMEOUT_MS, Math.floor(rawMs)),
  );
}

/** Resolves canonical creator handle from environment or `'aklapper'` default. */
export function resolveAgensiCreatorHandle(
  env: Readonly<Record<string, string | undefined>> = process.env,
): string {
  const raw = env['AGENSI_CREATOR_HANDLE']?.trim();
  return raw && raw.length > 0 ? raw : DEFAULT_AGENSI_CREATOR_HANDLE;
}

export function isAllowedUpstreamBaseUrl(rawBaseUrl: string): string | null {
  try {
    const parsed = new URL(rawBaseUrl);
    if (parsed.username || parsed.password) {
      return null;
    }
    if (parsed.protocol === 'https:') {
      return parsed.origin + parsed.pathname.replace(/\/+$/, '');
    }
    if (parsed.protocol === 'http:' && LOOPBACK_HOSTS.has(parsed.hostname.toLowerCase())) {
      return parsed.origin + parsed.pathname.replace(/\/+$/, '');
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Resolves Agensi API configuration from environment variables with bounded TTL and timeout
 * defaults.
 */
export function resolveAgensiCatalogConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
): ResolvedAgensiCatalogConfig {
  const creatorHandle = resolveAgensiCreatorHandle(env);
  const rawBaseUrl = env['AGENSI_API_BASE_URL']?.trim() ?? '';
  const baseUrl = rawBaseUrl ? isAllowedUpstreamBaseUrl(rawBaseUrl) : null;
  const rawPath = env['AGENSI_API_PATH']?.trim();
  const apiPath =
    rawPath && rawPath.length > 0 ? rawPath : `/api/creators/${encodeURIComponent(creatorHandle)}`;
  const rawApiKey = env['AGENSI_API_KEY']?.trim();

  const rawTtl = env['AGENSI_CACHE_TTL_SECONDS']?.trim();
  const parsedTtl = rawTtl !== undefined && rawTtl !== '' ? Number(rawTtl) : NaN;
  const ttlSeconds =
    Number.isFinite(parsedTtl) && parsedTtl >= 0
      ? Math.floor(parsedTtl)
      : DEFAULT_AGENSI_CACHE_TTL_SECONDS;

  const rawTimeout = env['AGENSI_FETCH_TIMEOUT_MS']?.trim();
  const parsedTimeout = rawTimeout !== undefined && rawTimeout !== '' ? Number(rawTimeout) : NaN;
  const timeoutMs = clampAgensiFetchTimeoutMs(
    Number.isFinite(parsedTimeout) ? parsedTimeout : undefined,
  );

  const rawOrigins = env['AGENSI_ALLOWED_ORIGINS']?.trim();
  const allowedOrigins = rawOrigins
    ? rawOrigins
        .split(',')
        .map(origin => origin.trim().replace(/\/+$/, ''))
        .filter(Boolean)
    : DEFAULT_AGENSI_ALLOWED_ORIGINS;

  return {
    baseUrl,
    apiPath,
    creatorHandle,
    ...(rawApiKey ? { apiKey: rawApiKey } : {}),
    ttlSeconds,
    timeoutMs,
    maxPages: MAX_AGENSI_PAGES,
    allowedOrigins: allowedOrigins.length > 0 ? allowedOrigins : DEFAULT_AGENSI_ALLOWED_ORIGINS,
  };
}

function resolveCreatorCandidate(
  item: AgensiRemoteSkillItem,
  envelopeCreatorHandle?: string | null,
): string | null {
  const creatorRef: AgensiRemoteCreatorRef | undefined = item.creator;
  const itemCandidate =
    item.creatorHandle ??
    item.creator_handle ??
    item.creatorSlug ??
    item.creator_slug ??
    item.authorHandle ??
    item.author_handle ??
    creatorRef?.handle ??
    creatorRef?.slug ??
    item.creatorId ??
    item.creator_id ??
    creatorRef?.id;
  if (itemCandidate && itemCandidate.trim().length > 0) {
    return itemCandidate.trim();
  }
  if (envelopeCreatorHandle && envelopeCreatorHandle.trim().length > 0) {
    return envelopeCreatorHandle.trim();
  }
  return null;
}

function isItemPublished(item: AgensiRemoteSkillItem, isCreatorProfileSkills: boolean): boolean {
  if (item.isPublished === false || item.is_published === false || item.published === false) {
    return false;
  }
  if (item.status !== undefined) {
    return item.status.trim().toLowerCase() === 'published';
  }
  if (item.isPublished === true || item.is_published === true || item.published === true) {
    return true;
  }
  return isCreatorProfileSkills;
}

function isTrustedSkillUrl(rawUrl: string, allowedOrigins: readonly string[]): string | null {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return null;
    }
    const normalizedAllowed = new Set(
      allowedOrigins.map(origin => {
        try {
          return new URL(origin).origin.toLowerCase();
        } catch {
          return origin.trim().replace(/\/+$/, '').toLowerCase();
        }
      }),
    );
    if (!normalizedAllowed.has(parsed.origin.toLowerCase())) {
      return null;
    }
    if (parsed.protocol === 'http:' && !LOOPBACK_HOSTS.has(parsed.hostname.toLowerCase())) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Enforces creator ownership, publish state, trusted URL origin, and slug uniqueness on parsed
 * Agensi items.
 */
export function filterCreatorPublishedSkills(
  rawItems: readonly unknown[],
  ownerHandle: string,
  allowedOrigins: readonly string[] = DEFAULT_AGENSI_ALLOWED_ORIGINS,
  context: FilterCreatorPublishedSkillsContext = {},
): FilterCreatorPublishedSkillsResult {
  const normalizedOwner = ownerHandle.trim().toLowerCase();
  const fetchedAtIso = (context.fetchedAt ?? new Date()).toISOString();
  const seenSlugs = context.seenSlugs ?? new Set<string>();
  const sortOffset = context.sortOffset ?? 0;
  const items: AgensiSkill[] = [];
  let rejectedForeignCount = 0;
  let rejectedUnpublishedCount = 0;
  let rejectedInvalidCount = 0;

  for (let idx = 0; idx < rawItems.length; idx += 1) {
    const parsedItem = AgensiRemoteSkillItemSchema.safeParse(rawItems[idx]);
    if (!parsedItem.success) {
      rejectedInvalidCount += 1;
      emitAgensiSeamLog('BOUNDARY_FAULT', 'agensi.catalog.payload_validation_failed', {
        correlationId: context.correlationId,
        reason: 'item_schema_invalid',
      });
      continue;
    }

    const item = parsedItem.data;
    const creatorCandidate = resolveCreatorCandidate(item, context.envelopeCreatorHandle);
    if (!creatorCandidate || creatorCandidate.toLowerCase() !== normalizedOwner) {
      rejectedForeignCount += 1;
      emitAgensiSeamLog('UNSOUND_CONDITION', 'agensi.catalog.foreign_creator_rejected', {
        correlationId: context.correlationId,
        slug: item.slug,
        expectedCreator: ownerHandle,
      });
      continue;
    }

    if (!isItemPublished(item, Boolean(context.isCreatorProfileSkills))) {
      rejectedUnpublishedCount += 1;
      emitAgensiSeamLog('UNSOUND_CONDITION', 'agensi.catalog.unpublished_item_rejected', {
        correlationId: context.correlationId,
        slug: item.slug,
      });
      continue;
    }

    const trustedUrl = isTrustedSkillUrl(item.url, allowedOrigins);
    const resolvedName = (item.name ?? item.title ?? '').trim();
    const resolvedSummary = (item.summary ?? item.description ?? '').trim();
    if (!trustedUrl || !resolvedName || !resolvedSummary || seenSlugs.has(item.slug)) {
      rejectedInvalidCount += 1;
      emitAgensiSeamLog('BOUNDARY_FAULT', 'agensi.catalog.payload_validation_failed', {
        correlationId: context.correlationId,
        slug: item.slug,
        reason: !trustedUrl
          ? 'untrusted_url'
          : seenSlugs.has(item.slug)
            ? 'duplicate_slug'
            : 'missing_required_text',
      });
      continue;
    }

    const validatedSkill = AgensiSkillSchema.safeParse({
      slug: item.slug.trim(),
      name: resolvedName,
      summary: resolvedSummary,
      tags: item.tags.map(tag => tag.trim()).filter(Boolean),
      url: trustedUrl,
      sortOrder: item.sortOrder ?? item.sort_order ?? sortOffset + items.length + 1,
      creatorHandle: ownerHandle,
      isPublished: true,
      syncedAt: fetchedAtIso,
      source: 'agensi_api',
    });

    if (!validatedSkill.success) {
      rejectedInvalidCount += 1;
      emitAgensiSeamLog('BOUNDARY_FAULT', 'agensi.catalog.payload_validation_failed', {
        correlationId: context.correlationId,
        slug: item.slug,
        reason: 'normalized_skill_invalid',
      });
      continue;
    }

    seenSlugs.add(item.slug);
    items.push(validatedSkill.data);
  }

  return {
    items,
    rejectedForeignCount,
    rejectedUnpublishedCount,
    rejectedInvalidCount,
  };
}
