// Bounded context: PostgreSQL transactional Agensi catalog sync and row locking.
// Invariant: Single-writer transactional reconciliation protects creator-published rows across replicas.

import type { AgensiSkill, AgensiSyncState } from '@aklapper/core';
import {
  type AgensiCatalogFetchResult,
  fetchAgensiCreatorCatalog,
  resolveAgensiCatalogConfig,
  type ResolvedAgensiCatalogConfig,
} from '@aklapper/node-runtime/agensi';
import { and, eq, inArray, isNull, notInArray, or, sql } from 'drizzle-orm';

import {
  formatSyncStateRow,
  parseTimestampMs,
  queryCreatorPublishedSkills,
  readAgensiSyncState,
  recordUpstreamFailureState,
  scrubErrorText,
} from './agensi-cache-store.ts';
import type { AppDatabase } from './client.ts';
import * as schema from './schema.ts';

export {
  deleteCreatorAgensiCache,
  queryCreatorPublishedSkills,
  readAgensiSyncState,
} from './agensi-cache-store.ts';

export interface AgensiSyncOptions {
  readonly correlationId?: string;
  readonly skipLiveSync?: boolean;
  readonly forceRefresh?: boolean;
  readonly fetchImpl?: typeof fetch;
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly onBeforeSyncStateCommitForTest?: () => Promise<void> | void;
}

export interface AgensiSyncMutationResult {
  readonly creatorHandle: string;
  readonly syncState: AgensiSyncState;
  readonly skills: readonly AgensiSkill[];
  readonly notModified: boolean;
  readonly syncedCount: number;
  readonly deactivatedCount: number;
  readonly staleWriteSkipped?: boolean;
}

const inFlightSyncsByDb = new WeakMap<
  AppDatabase,
  Map<string, Promise<AgensiSyncMutationResult>>
>();

async function commitAgensiFetchInTx(
  db: AppDatabase,
  config: ResolvedAgensiCatalogConfig,
  fetchResult: Extract<AgensiCatalogFetchResult, { ok: true }>,
  preFetchLastSyncedMs: number | null,
  options: AgensiSyncOptions,
  startedAtMs: number,
): Promise<AgensiSyncMutationResult> {
  const creatorHandle = config.creatorHandle;
  const normalizedCreator = creatorHandle.toLowerCase();

  return db.transaction(async tx => {
    await tx
      .insert(schema.agensiSyncState)
      .values({ creatorHandle, lastStatus: 'idle', itemCount: 0 })
      .onConflictDoNothing({ target: schema.agensiSyncState.creatorHandle });

    const lockRows = await tx.execute(
      sql`SELECT creator_handle, last_synced_at FROM agensi_sync_state WHERE creator_handle = ${creatorHandle} FOR UPDATE`,
    );
    const lockedRow = (lockRows.rows[0] ?? {}) as Record<string, unknown>;
    const postLockLastSyncedMs = parseTimestampMs(lockedRow['last_synced_at']);

    // Post-lock predicate re-validation prevents slower fetches from overwriting fresher commits.
    const committedWhileFetching =
      postLockLastSyncedMs !== preFetchLastSyncedMs && postLockLastSyncedMs !== null;
    const isSupersededTimestamp =
      committedWhileFetching && postLockLastSyncedMs >= fetchResult.fetchedAt.getTime();
    const isFreshByConcurrentWriter =
      committedWhileFetching &&
      !options.forceRefresh &&
      Date.now() - postLockLastSyncedMs < config.ttlSeconds * 1000;

    if (isSupersededTimestamp || isFreshByConcurrentWriter) {
      console.warn(
        JSON.stringify({
          seam_type: 'UNSOUND_CONDITION',
          event: 'agensi.cache.stale_write_skipped',
          correlationId: options.correlationId,
          creatorHandle,
        }),
      );
      const [currentState, currentSkills] = await Promise.all([
        readAgensiSyncState(tx, creatorHandle),
        queryCreatorPublishedSkills(tx, creatorHandle),
      ]);
      return {
        creatorHandle,
        syncState: formatSyncStateRow(currentState ?? undefined, creatorHandle),
        skills: currentSkills,
        notModified: fetchResult.notModified,
        syncedCount: 0,
        deactivatedCount: 0,
        staleWriteSkipped: true,
      };
    }

    let syncedCount = 0;
    let deactivatedCount = 0;

    if (!fetchResult.notModified) {
      const ownershipScope =
        normalizedCreator === 'aklapper'
          ? or(
              sql`lower(${schema.agensiSkills.creatorHandle}) = lower(${creatorHandle})`,
              isNull(schema.agensiSkills.creatorHandle),
            )
          : sql`lower(${schema.agensiSkills.creatorHandle}) = lower(${creatorHandle})`;

      const activeSlugs = fetchResult.items.map(item => item.slug);
      const pruneWhere =
        activeSlugs.length > 0
          ? and(
              ownershipScope,
              inArray(schema.agensiSkills.source, ['agensi_api', 'seed']),
              eq(schema.agensiSkills.isPublished, true),
              notInArray(schema.agensiSkills.slug, activeSlugs),
            )
          : and(
              ownershipScope,
              inArray(schema.agensiSkills.source, ['agensi_api', 'seed']),
              eq(schema.agensiSkills.isPublished, true),
            );

      const deactivated = await tx
        .update(schema.agensiSkills)
        .set({ isPublished: false, syncedAt: fetchResult.fetchedAt })
        .where(pruneWhere)
        .returning({ slug: schema.agensiSkills.slug });
      deactivatedCount = deactivated.length;

      for (const item of fetchResult.items) {
        await tx
          .insert(schema.agensiSkills)
          .values({
            slug: item.slug,
            name: item.name,
            summary: item.summary,
            tags: [...item.tags],
            url: item.url,
            sortOrder: item.sortOrder,
            creatorHandle,
            isPublished: true,
            syncedAt: fetchResult.fetchedAt,
            source: 'agensi_api',
          })
          .onConflictDoUpdate({
            target: schema.agensiSkills.slug,
            set: {
              name: item.name,
              summary: item.summary,
              tags: [...item.tags],
              url: item.url,
              sortOrder: item.sortOrder,
              creatorHandle,
              isPublished: true,
              syncedAt: fetchResult.fetchedAt,
              source: 'agensi_api',
            },
          });
      }
      syncedCount = fetchResult.items.length;
    }

    if (options.onBeforeSyncStateCommitForTest) {
      await options.onBeforeSyncStateCommitForTest();
    }

    const activeSkills = await queryCreatorPublishedSkills(tx, creatorHandle);
    const nextStatus = activeSkills.length > 0 ? 'ok' : 'empty';
    const [updatedState] = await tx
      .update(schema.agensiSyncState)
      .set({
        lastSyncedAt: fetchResult.fetchedAt,
        lastAttemptAt: new Date(),
        lastStatus: nextStatus,
        lastError: null,
        itemCount: activeSkills.length,
        etag: fetchResult.etag,
      })
      .where(eq(schema.agensiSyncState.creatorHandle, creatorHandle))
      .returning();

    console.info(
      JSON.stringify({
        event: 'agensi.sync.completed',
        correlationId: options.correlationId,
        creatorHandle,
        branch: 'live_sync',
        fallbackUsed: false,
        notModified: fetchResult.notModified,
        syncedCount,
        deactivatedCount,
        durationMs: Date.now() - startedAtMs,
        source: 'agensi_api',
      }),
    );

    return {
      creatorHandle,
      syncState: formatSyncStateRow(updatedState, creatorHandle),
      skills: activeSkills,
      notModified: fetchResult.notModified,
      syncedCount,
      deactivatedCount,
    };
  });
}

async function executeSyncForCreator(
  db: AppDatabase,
  config: ResolvedAgensiCatalogConfig,
  options: AgensiSyncOptions,
): Promise<AgensiSyncMutationResult> {
  const startedAtMs = Date.now();
  const [preState, existingActive] = await Promise.all([
    readAgensiSyncState(db, config.creatorHandle),
    queryCreatorPublishedSkills(db, config.creatorHandle),
  ]);
  const preFetchLastSyncedMs = preState?.lastSyncedAt?.getTime() ?? null;

  const fetchResult = await fetchAgensiCreatorCatalog(
    {
      baseUrl: config.baseUrl ?? '',
      apiPath: config.apiPath,
      creatorHandle: config.creatorHandle,
      ...(config.apiKey ? { apiKey: config.apiKey } : {}),
      timeoutMs: config.timeoutMs,
      maxPages: config.maxPages,
      allowedOrigins: config.allowedOrigins,
    },
    {
      correlationId: options.correlationId,
      etag: options.forceRefresh || existingActive.length === 0 ? null : (preState?.etag ?? null),
      fetchImpl: options.fetchImpl,
    },
  );

  if (!fetchResult.ok) {
    const safeMsg = scrubErrorText(fetchResult.message, config.apiKey);
    await recordUpstreamFailureState(db, config.creatorHandle, safeMsg, startedAtMs);
    throw new Error(safeMsg);
  }

  try {
    return await commitAgensiFetchInTx(
      db,
      config,
      fetchResult,
      preFetchLastSyncedMs,
      options,
      startedAtMs,
    );
  } catch (error) {
    console.warn(
      JSON.stringify({
        seam_type: 'DELTA_AUDIT_GAP',
        event: 'agensi.sync.reconcile_outcome_unlogged',
        correlationId: options.correlationId,
        creatorHandle: config.creatorHandle,
      }),
    );
    throw error;
  }
}

/** Fetches and reconciles live Agensi catalog rows for the configured creator atomically in PG19. */
export async function syncAgensiCatalog(
  db: AppDatabase,
  options: AgensiSyncOptions = {},
): Promise<AgensiSyncMutationResult> {
  const config = resolveAgensiCatalogConfig(options.env);
  if (options.onBeforeSyncStateCommitForTest) {
    return executeSyncForCreator(db, config, options);
  }
  const key = `${config.creatorHandle.toLowerCase()}::${options.forceRefresh ? 'force' : 'std'}`;
  let dbMap = inFlightSyncsByDb.get(db);
  if (!dbMap) {
    dbMap = new Map();
    inFlightSyncsByDb.set(db, dbMap);
  }
  const existing = dbMap.get(key);
  if (existing) {
    return existing;
  }
  const pending = executeSyncForCreator(db, config, options).finally(() => {
    dbMap?.delete(key);
  });
  dbMap.set(key, pending);
  return pending;
}
