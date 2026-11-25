// Bounded context: External Agensi HTTP catalog client and pagination orchestration.
// Invariant: Bounded timeout (<= 2000ms), direct 304 support, secret scrubbing, and fail-closed validation.

import { AgensiRemoteResponseSchema, type AgensiSkill } from '@aklapper/core';

import {
  type AgensiCatalogAdapterConfig,
  emitAgensiSeamLog,
  filterCreatorPublishedSkills,
  isAllowedUpstreamBaseUrl,
  MAX_AGENSI_PAGES,
  clampAgensiFetchTimeoutMs,
} from './agensi-filter.ts';
import { joinUpstreamUrl } from './http.ts';

export * from './agensi-filter.ts';

export interface FetchAgensiCatalogOptions {
  readonly correlationId?: string;
  readonly etag?: string | null;
  readonly fetchImpl?: typeof fetch;
  readonly signal?: AbortSignal;
}

export type AgensiCatalogFetchResult =
  | {
      readonly ok: true;
      readonly notModified: true;
      readonly fetchedAt: Date;
      readonly etag: string | null;
    }
  | {
      readonly ok: true;
      readonly notModified: false;
      readonly items: readonly AgensiSkill[];
      readonly fetchedAt: Date;
      readonly etag: string | null;
      readonly rejectedForeignCount: number;
      readonly rejectedUnpublishedCount: number;
      readonly rejectedInvalidCount: number;
    }
  | {
      readonly ok: false;
      readonly errorCode: string;
      readonly httpStatus?: number;
      readonly message: string;
    };

function sanitizeAgensiErrorMessage(error: unknown, apiKey?: string): string {
  const raw = error instanceof Error ? error.message : String(error ?? 'Agensi request failed');
  const trimmedKey = apiKey?.trim();
  const scrubbed = trimmedKey ? raw.replaceAll(trimmedKey, '[REDACTED]') : raw;
  return scrubbed.slice(0, 240);
}

function buildPagePath(apiPath: string, cursor: string | null, pageNumber: number | null): string {
  if (!cursor && pageNumber === null) {
    return apiPath;
  }
  const url = new URL(apiPath.startsWith('/') ? apiPath : `/${apiPath}`, 'http://agensi.local');
  if (cursor) {
    url.searchParams.set('cursor', cursor);
  } else if (pageNumber !== null) {
    url.searchParams.set('page', String(pageNumber));
  }
  return `${url.pathname}${url.search}`;
}

function isTimeoutOrAbortError(error: unknown): boolean {
  return error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
}

function buildTimeoutFetchResult(timeoutMs: number): AgensiCatalogFetchResult {
  return {
    ok: false,
    errorCode: 'AGENSI_TIMEOUT',
    message: `Agensi catalog request timed out after ${timeoutMs}ms.`,
  };
}

/**
 * Fetches published Agensi skills owned by `config.creatorHandle` under a bounded latency and page
 * budget. Upstream: Agensi HTTP API (`200 OK` JSON envelope or `304 Not Modified`). Downstream:
 * Transactional PostgreSQL catalog sync and runtime SSR fallback.
 */
export async function fetchAgensiCreatorCatalog(
  config: AgensiCatalogAdapterConfig,
  options: FetchAgensiCatalogOptions = {},
): Promise<AgensiCatalogFetchResult> {
  const safeBaseUrl = config.baseUrl ? isAllowedUpstreamBaseUrl(config.baseUrl) : null;
  if (!safeBaseUrl) {
    return {
      ok: false,
      errorCode: 'AGENSI_NOT_CONFIGURED',
      message: 'AGENSI_API_BASE_URL is unset or invalid.',
    };
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = clampAgensiFetchTimeoutMs(config.timeoutMs);
  const maxPages = Math.max(1, Math.min(MAX_AGENSI_PAGES, Math.floor(config.maxPages)));
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const signal = options.signal ? AbortSignal.any([options.signal, timeoutSignal]) : timeoutSignal;
  const fetchedAt = new Date();
  const seenSlugs = new Set<string>();
  const seenCursors = new Set<string>();
  const collected: AgensiSkill[] = [];

  let rejectedForeignCount = 0;
  let rejectedUnpublishedCount = 0;
  let rejectedInvalidCount = 0;
  let page1Etag: string | null = null;
  let nextCursor: string | null = null;
  let nextPageNumber: number | null = null;

  for (let pageIdx = 0; pageIdx < maxPages; pageIdx += 1) {
    const targetPath = buildPagePath(config.apiPath, nextCursor, nextPageNumber);
    const targetUrl = joinUpstreamUrl(safeBaseUrl, targetPath);
    const headers = new Headers({ accept: 'application/json' });
    if (config.apiKey?.trim()) {
      headers.set('x-api-key', config.apiKey.trim());
    }
    if (pageIdx === 0 && options.etag) {
      headers.set('if-none-match', options.etag);
    }

    let response: Response;
    try {
      response = await fetchImpl(targetUrl, {
        method: 'GET',
        headers,
        signal,
      });
    } catch (error) {
      if (isTimeoutOrAbortError(error)) {
        return buildTimeoutFetchResult(timeoutMs);
      }
      return {
        ok: false,
        errorCode: 'AGENSI_UNAVAILABLE',
        message: `Agensi catalog request failed: ${sanitizeAgensiErrorMessage(error, config.apiKey)}`,
      };
    }

    if (pageIdx === 0 && response.status === 304) {
      await response.body?.cancel().catch(() => {});
      return {
        ok: true,
        notModified: true,
        fetchedAt,
        etag: response.headers.get('etag') ?? options.etag ?? null,
      };
    }

    if (!response.ok) {
      await response.body?.cancel().catch(() => {});
      return {
        ok: false,
        errorCode: 'AGENSI_HTTP_ERROR',
        httpStatus: response.status,
        message: `Agensi catalog upstream returned HTTP ${response.status}.`,
      };
    }

    if (pageIdx === 0) {
      page1Etag = response.headers.get('etag');
    }

    let rawJson: unknown;
    try {
      rawJson = (await response.json()) as unknown;
    } catch (error) {
      if (isTimeoutOrAbortError(error)) {
        return buildTimeoutFetchResult(timeoutMs);
      }
      emitAgensiSeamLog('BOUNDARY_FAULT', 'agensi.catalog.payload_validation_failed', {
        correlationId: options.correlationId,
        reason: 'malformed_json',
      });
      return {
        ok: false,
        errorCode: 'AGENSI_INVALID_PAYLOAD',
        message: 'Agensi catalog response was not valid JSON.',
      };
    }

    if (!rawJson || typeof rawJson !== 'object' || Array.isArray(rawJson)) {
      emitAgensiSeamLog('BOUNDARY_FAULT', 'agensi.catalog.payload_validation_failed', {
        correlationId: options.correlationId,
        reason: 'envelope_not_object',
      });
      return {
        ok: false,
        errorCode: 'AGENSI_INVALID_PAYLOAD',
        message: 'Agensi catalog envelope must be a JSON object.',
      };
    }

    const rawRecord = rawJson as Record<string, unknown>;
    const rawItemsCandidate = rawRecord['items'] ?? rawRecord['skills'] ?? rawRecord['data'];
    if (!Array.isArray(rawItemsCandidate)) {
      emitAgensiSeamLog('BOUNDARY_FAULT', 'agensi.catalog.payload_validation_failed', {
        correlationId: options.correlationId,
        reason: 'missing_items_array',
      });
      return {
        ok: false,
        errorCode: 'AGENSI_INVALID_PAYLOAD',
        message: 'Agensi catalog envelope is missing an items or skills array.',
      };
    }

    const envelopeMetaCheck = AgensiRemoteResponseSchema.safeParse({
      ...rawRecord,
      items: undefined,
      skills: undefined,
      data: undefined,
    });
    if (!envelopeMetaCheck.success) {
      emitAgensiSeamLog('BOUNDARY_FAULT', 'agensi.catalog.payload_validation_failed', {
        correlationId: options.correlationId,
        reason: 'envelope_metadata_invalid',
      });
      return {
        ok: false,
        errorCode: 'AGENSI_INVALID_PAYLOAD',
        message: 'Agensi catalog envelope metadata failed validation.',
      };
    }

    const meta = envelopeMetaCheck.data;
    const isCreatorProfileSkills = Array.isArray(rawRecord['skills']);
    const envelopeCreatorHandle =
      meta.creator?.slug ??
      meta.creator?.handle ??
      meta.creatorHandle ??
      meta.creator_handle ??
      meta.creatorSlug ??
      meta.creator_slug ??
      (isCreatorProfileSkills ? meta.slug : undefined) ??
      null;

    const filtered = filterCreatorPublishedSkills(
      rawItemsCandidate,
      config.creatorHandle,
      config.allowedOrigins,
      {
        envelopeCreatorHandle,
        isCreatorProfileSkills,
        fetchedAt,
        correlationId: options.correlationId,
        sortOffset: collected.length,
        seenSlugs,
      },
    );

    collected.push(...filtered.items);
    rejectedForeignCount += filtered.rejectedForeignCount;
    rejectedUnpublishedCount += filtered.rejectedUnpublishedCount;
    rejectedInvalidCount += filtered.rejectedInvalidCount;

    const candidateCursor = meta.nextCursor ?? meta.next_cursor ?? meta.cursor ?? null;
    const candidateTotalPages = meta.totalPages ?? meta.total_pages;
    const candidateNextPage =
      meta.nextPage ??
      meta.next_page ??
      (meta.page !== undefined &&
      candidateTotalPages !== undefined &&
      meta.page < candidateTotalPages
        ? meta.page + 1
        : null);

    if (candidateCursor) {
      if (seenCursors.has(candidateCursor)) {
        break;
      }
      seenCursors.add(candidateCursor);
      nextCursor = candidateCursor;
      nextPageNumber = null;
      continue;
    }

    if (candidateNextPage !== null) {
      const pageKey = `page:${candidateNextPage}`;
      if (seenCursors.has(pageKey)) {
        break;
      }
      seenCursors.add(pageKey);
      nextCursor = null;
      nextPageNumber = candidateNextPage;
      continue;
    }

    break;
  }

  collected.sort((a, b) => a.sortOrder - b.sortOrder || a.slug.localeCompare(b.slug));

  return {
    ok: true,
    notModified: false,
    items: collected,
    fetchedAt,
    etag: page1Etag,
    rejectedForeignCount,
    rejectedUnpublishedCount,
    rejectedInvalidCount,
  };
}
