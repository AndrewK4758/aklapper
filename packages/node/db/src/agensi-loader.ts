// Bounded context: Read-through PostgreSQL Agensi loader with TTL caching, prerender isolation, and fallback.
// Invariant: Outage fallback serves only prior creator-published DB cache or fails closed to 0 items.

import type {
  AgensiCatalogMeta,
  AgensiSkill,
  AgensiSyncState,
  StatusBadgeSpec,
} from '@aklapper/core';
import { resolveAgensiCatalogConfig } from '@aklapper/node-runtime/agensi';

import {
  emitBranchSeamLog,
  formatSyncStateRow,
  queryCreatorPublishedSkills,
  readAgensiSyncState,
  scrubErrorText,
} from './agensi-cache-store.ts';
import { type AgensiSyncOptions, syncAgensiCatalog } from './agensi-sync.ts';
import type { AppDatabase } from './client.ts';

export interface AgensiCatalogLoadResult {
  readonly skills: readonly AgensiSkill[];
  readonly catalogMeta: AgensiCatalogMeta;
  readonly statusBadgeOverride?: StatusBadgeSpec;
  readonly syncState: AgensiSyncState | null;
}

/** Read-through creator catalog loader supporting fresh TTL hits, prerender isolation, and fallback. */
export async function loadCreatorAgensiCatalog(
  db: AppDatabase,
  options: AgensiSyncOptions = {},
): Promise<AgensiCatalogLoadResult> {
  const config = resolveAgensiCatalogConfig(options.env);
  const [preState, cachedSkills] = await Promise.all([
    readAgensiSyncState(db, config.creatorHandle),
    queryCreatorPublishedSkills(db, config.creatorHandle),
  ]);
  const cachedSyncState = preState ? formatSyncStateRow(preState, config.creatorHandle) : null;
  const lastSyncedIso = cachedSyncState?.lastSyncedAt ?? null;

  if (options.skipLiveSync) {
    emitBranchSeamLog('prerender_seed', {
      correlationId: options.correlationId,
      creatorHandle: config.creatorHandle,
      fallbackUsed: false,
    });
    return {
      skills: cachedSkills,
      catalogMeta: {
        mode: 'prerender',
        creatorHandle: config.creatorHandle,
        syncedAt: lastSyncedIso,
      },
      syncState: cachedSyncState,
    };
  }

  const isTtlFresh = Boolean(
    !options.forceRefresh &&
    preState?.lastSyncedAt &&
    config.ttlSeconds > 0 &&
    Date.now() - preState.lastSyncedAt.getTime() < config.ttlSeconds * 1000 &&
    (preState.lastStatus === 'ok' || preState.lastStatus === 'empty'),
  );

  if (isTtlFresh) {
    emitBranchSeamLog('cache_hit', {
      correlationId: options.correlationId,
      creatorHandle: config.creatorHandle,
      fallbackUsed: false,
      cachedCount: cachedSkills.length,
    });
    return {
      skills: cachedSkills,
      catalogMeta: { mode: 'cache', creatorHandle: config.creatorHandle, syncedAt: lastSyncedIso },
      syncState: cachedSyncState,
    };
  }

  if (!config.baseUrl) {
    const mode = cachedSkills.length > 0 ? 'cached_fallback' : 'empty';
    emitBranchSeamLog(cachedSkills.length > 0 ? 'stale_fallback' : 'cold_empty', {
      correlationId: options.correlationId,
      creatorHandle: config.creatorHandle,
      fallbackUsed: true,
      cachedCount: cachedSkills.length,
    });
    return {
      skills: cachedSkills,
      catalogMeta: { mode, creatorHandle: config.creatorHandle, syncedAt: lastSyncedIso },
      statusBadgeOverride: {
        source: 'agensi-catalog',
        state: 'idle',
        label: cachedSkills.length > 0 ? 'catalog · cached fallback' : 'catalog · unavailable',
      },
      syncState: cachedSyncState,
    };
  }

  try {
    const synced = await syncAgensiCatalog(db, options);
    emitBranchSeamLog(synced.skills.length > 0 ? 'live_sync' : 'cold_empty', {
      correlationId: options.correlationId,
      creatorHandle: config.creatorHandle,
      fallbackUsed: false,
      syncedCount: synced.skills.length,
    });
    return {
      skills: synced.skills,
      catalogMeta: {
        mode: synced.skills.length > 0 ? 'live' : 'empty',
        creatorHandle: config.creatorHandle,
        syncedAt: synced.syncState.lastSyncedAt,
      },
      syncState: synced.syncState,
    };
  } catch (error) {
    const [latestState, fallbackSkills] = await Promise.all([
      readAgensiSyncState(db, config.creatorHandle),
      queryCreatorPublishedSkills(db, config.creatorHandle),
    ]);
    const hasCached = fallbackSkills.length > 0;
    const branch = hasCached ? 'stale_fallback' : 'cold_empty';
    emitBranchSeamLog(branch, {
      correlationId: options.correlationId,
      creatorHandle: config.creatorHandle,
      fallbackUsed: true,
      cachedCount: fallbackSkills.length,
      errorMessage: scrubErrorText(
        error instanceof Error ? error.message : String(error),
        config.apiKey,
      ),
    });
    const formatted = latestState ? formatSyncStateRow(latestState, config.creatorHandle) : null;
    return {
      skills: fallbackSkills,
      catalogMeta: {
        mode: hasCached ? 'cached_fallback' : 'empty',
        creatorHandle: config.creatorHandle,
        syncedAt: formatted?.lastSyncedAt ?? null,
      },
      statusBadgeOverride: {
        source: 'agensi-catalog',
        state: 'idle',
        label: hasCached ? 'catalog · cached fallback' : 'catalog · unavailable',
      },
      syncState: formatted,
    };
  }
}
