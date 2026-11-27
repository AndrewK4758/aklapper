import {
  type AskTurnState,
  AskResponseSchema,
  AskTurnStateSchema,
  type PublicAppError,
  createPublicAppError,
} from '@aklapper/core';
import { and, eq, gt, inArray, lt } from 'drizzle-orm';

import type { AppDatabase } from './client.ts';
import * as schema from './schema.ts';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_ASK_TURN_RETENTION_DAYS = 90;
const TERMINAL_ASK_TURN_STATUSES = ['completed', 'abstained', 'failed', 'expired'] as const;

export function resolveAskTurnRetentionDays(
  env: Record<string, string | undefined> = process.env,
): number {
  const raw = env['ASK_TURN_RETENTION_DAYS']?.trim();
  if (!raw) return DEFAULT_ASK_TURN_RETENTION_DAYS;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_ASK_TURN_RETENTION_DAYS;
  }
  return parsed;
}

function mapErrorCodeToPublicError(
  errorCode: string | null,
  correlationId: string,
  status: 'failed' | 'expired',
): PublicAppError {
  if (status === 'expired' || errorCode === 'ERR_STREAM_TIMEOUT') {
    return createPublicAppError({
      code: 'ERR_STREAM_TIMEOUT',
      status: 504,
      message: 'Section took too long to load.',
      action: 'Retry loading or refresh.',
      correlationId,
    });
  }
  if (errorCode === 'ERR_STREAM_ABORTED') {
    return createPublicAppError({
      code: 'ERR_STREAM_ABORTED',
      status: 499,
      message: 'Request cancelled early.',
      action: 'Retry if you still need this view.',
      correlationId,
    });
  }
  if (errorCode === 'ERR_FORBIDDEN') {
    return createPublicAppError({
      code: 'ERR_FORBIDDEN',
      status: 403,
      message: 'Permission denied for action.',
      action: 'Return home or sign in again.',
      correlationId,
    });
  }
  return createPublicAppError({
    code: 'ERR_UPSTREAM_UNAVAILABLE',
    status: 503,
    message: 'Upstream service unreachable.',
    action: 'Retry shortly or go home.',
    correlationId,
  });
}

export async function getAskTurnByAttemptId(
  db: AppDatabase,
  attemptId: string,
  sessionId: string,
  now = new Date(),
): Promise<AskTurnState | null> {
  const normalizedAttemptId = attemptId.trim();
  const normalizedSessionId = sessionId.trim();
  if (!UUID_RE.test(normalizedAttemptId) || !normalizedSessionId) {
    return null;
  }

  const [row] = await db
    .select()
    .from(schema.askTurns)
    .where(
      and(
        eq(schema.askTurns.attemptId, normalizedAttemptId),
        eq(schema.askTurns.sessionId, normalizedSessionId),
        gt(schema.askTurns.expiresAt, now),
      ),
    )
    .limit(1);

  if (!row) {
    return null;
  }

  const parsedResponse = row.resultJson ? AskResponseSchema.safeParse(row.resultJson) : null;

  return AskTurnStateSchema.parse({
    attemptId: row.attemptId,
    status: row.status,
    mode: row.mode,
    ...(row.conversationId ? { conversationId: row.conversationId } : {}),
    ...(row.turnIndex !== null && row.turnIndex !== undefined ? { turnIndex: row.turnIndex } : {}),
    correlationId: row.correlationId,
    leaseExpiresAt: row.leaseExpiresAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    ...(parsedResponse?.success ? { response: parsedResponse.data } : {}),
    ...(row.status === 'failed' || row.status === 'expired'
      ? { error: mapErrorCodeToPublicError(row.errorCode, row.correlationId, row.status) }
      : {}),
  });
}

export async function pruneExpiredAskTurns(
  db: AppDatabase,
  now = new Date(),
  retentionDays = resolveAskTurnRetentionDays(),
): Promise<number> {
  const safeDays = Math.max(1, Math.floor(retentionDays));
  const cutoff = new Date(now.getTime() - safeDays * 86_400_000);
  const deleted = await db
    .delete(schema.askTurns)
    .where(
      and(
        inArray(schema.askTurns.status, [...TERMINAL_ASK_TURN_STATUSES]),
        lt(schema.askTurns.createdAt, cutoff),
      ),
    )
    .returning({ attemptId: schema.askTurns.attemptId });
  return deleted.length;
}
