// Bounded context: PostgreSQL query primitives, mappers, and diagnostic telemetry for Agensi caching.
// Invariant: Readers strictly scope rows to canonical creator_handle and is_published = true.

import {
  type AgensiSkill,
  AgensiSkillSchema,
  type AgensiSyncState,
  AgensiSyncStateSchema,
} from '@aklapper/core';
import { resolveAgensiCreatorHandle } from '@aklapper/node-runtime/agensi';
import { and, asc, eq, sql } from 'drizzle-orm';

import type { AppDatabase } from './client.ts';
import * as schema from './schema.ts';

export type DbExecutor = Pick<AppDatabase, 'select' | 'insert' | 'update' | 'delete' | 'execute'>;

export function formatSyncStateRow(
  row: typeof schema.agensiSyncState.$inferSelect | undefined,
  creatorHandle: string,
): AgensiSyncState {
  if (!row) {
    return AgensiSyncStateSchema.parse({
      creatorHandle,
      lastSyncedAt: null,
      lastAttemptAt: null,
      lastStatus: 'idle',
      lastError: null,
      itemCount: 0,
    });
  }
  return AgensiSyncStateSchema.parse({
    creatorHandle: row.creatorHandle,
    lastSyncedAt: row.lastSyncedAt ? row.lastSyncedAt.toISOString() : null,
    lastAttemptAt: row.lastAttemptAt ? row.lastAttemptAt.toISOString() : null,
    lastStatus: row.lastStatus,
    lastError: row.lastError ?? null,
    itemCount: row.itemCount,
  });
}

export function mapAgensiSkillRow(row: typeof schema.agensiSkills.$inferSelect): AgensiSkill {
  return AgensiSkillSchema.parse({
    slug: row.slug,
    name: row.name,
    summary: row.summary,
    tags: row.tags,
    url: row.url,
    sortOrder: row.sortOrder,
    creatorHandle: row.creatorHandle ?? null,
    isPublished: row.isPublished,
    syncedAt: row.syncedAt ? row.syncedAt.toISOString() : null,
    source: row.source,
  });
}

/** Reads published Agensi skills owned strictly by `creatorHandle`. */
export async function queryCreatorPublishedSkills(
  executor: DbExecutor,
  creatorHandle = resolveAgensiCreatorHandle(),
): Promise<AgensiSkill[]> {
  const rows = await executor
    .select()
    .from(schema.agensiSkills)
    .where(
      and(
        sql`lower(${schema.agensiSkills.creatorHandle}) = lower(${creatorHandle})`,
        eq(schema.agensiSkills.isPublished, true),
      ),
    )
    .orderBy(asc(schema.agensiSkills.sortOrder), asc(schema.agensiSkills.slug));

  return rows.map(mapAgensiSkillRow);
}

/** Reads the persisted sync state row for `creatorHandle`, or returns null when absent. */
export async function readAgensiSyncState(
  executor: DbExecutor,
  creatorHandle = resolveAgensiCreatorHandle(),
): Promise<typeof schema.agensiSyncState.$inferSelect | null> {
  const [row] = await executor
    .select()
    .from(schema.agensiSyncState)
    .where(eq(schema.agensiSyncState.creatorHandle, creatorHandle))
    .limit(1);
  return row ?? null;
}

export function emitBranchSeamLog(
  branchTaken: 'live_sync' | 'cache_hit' | 'stale_fallback' | 'prerender_seed' | 'cold_empty',
  detail: Readonly<Record<string, unknown>>,
): void {
  console.info(
    JSON.stringify({
      seam_type: 'RULE_DIVERGENCE',
      metric: 'seam_decision_branch_total',
      event: 'agensi.catalog.load_branch',
      branch_taken: branchTaken,
      ...detail,
    }),
  );
}

export function scrubErrorText(message: string, apiKey?: string): string {
  const trimmed = apiKey?.trim();
  const scrubbed = trimmed ? message.replaceAll(trimmed, '[REDACTED]') : message;
  return scrubbed.slice(0, 300);
}

export function parseTimestampMs(raw: unknown): number | null {
  if (raw instanceof Date) return Number.isFinite(raw.getTime()) ? raw.getTime() : null;
  if (typeof raw === 'string' && raw.trim()) {
    const ms = Date.parse(raw);
    return Number.isFinite(ms) ? ms : null;
  }
  return null;
}

export async function recordUpstreamFailureState(
  db: AppDatabase,
  creatorHandle: string,
  errorMessage: string,
  attemptStartedAtMs = Date.now(),
): Promise<typeof schema.agensiSyncState.$inferSelect | null> {
  try {
    const attemptAt = new Date(attemptStartedAtMs);
    return await db.transaction(async tx => {
      await tx
        .insert(schema.agensiSyncState)
        .values({ creatorHandle, lastStatus: 'idle', itemCount: 0 })
        .onConflictDoNothing({ target: schema.agensiSyncState.creatorHandle });

      const lockRows = await tx.execute(
        sql`SELECT last_synced_at, last_attempt_at FROM agensi_sync_state WHERE creator_handle = ${creatorHandle} FOR UPDATE`,
      );
      const lockedRow = (lockRows.rows[0] ?? {}) as Record<string, unknown>;
      const postLockLastSyncedMs = parseTimestampMs(lockedRow['last_synced_at']);
      const postLockLastAttemptMs = parseTimestampMs(lockedRow['last_attempt_at']);

      // Preserve newer successful syncs or attempts committed while this request was in flight.
      if (
        (postLockLastSyncedMs !== null && postLockLastSyncedMs >= attemptStartedAtMs) ||
        (postLockLastAttemptMs !== null && postLockLastAttemptMs >= attemptStartedAtMs)
      ) {
        return readAgensiSyncState(tx, creatorHandle);
      }

      const [updated] = await tx
        .update(schema.agensiSyncState)
        .set({
          lastAttemptAt: attemptAt,
          lastStatus: 'error',
          lastError: errorMessage,
        })
        .where(eq(schema.agensiSyncState.creatorHandle, creatorHandle))
        .returning();
      return updated ?? null;
    });
  } catch {
    return null;
  }
}

/** Deletes cached Agensi skill rows and sync state scoped strictly to `creatorHandle`. */
export async function deleteCreatorAgensiCache(
  db: AppDatabase,
  creatorHandle: string,
): Promise<void> {
  await db
    .delete(schema.agensiSyncState)
    .where(eq(schema.agensiSyncState.creatorHandle, creatorHandle));
  await db
    .delete(schema.agensiSkills)
    .where(sql`lower(${schema.agensiSkills.creatorHandle}) = lower(${creatorHandle})`);
}
