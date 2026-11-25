import {
  type AskTurnState,
  AskResponseSchema,
  AskTurnStateSchema,
  type PublicAppError,
  createPublicAppError,
} from '@aklapper/core';
import { and, eq, lt } from 'drizzle-orm';

import type { AppDatabase } from './client.ts';
import * as schema from './schema.ts';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

export async function pruneExpiredAskTurns(db: AppDatabase, cutoff = new Date()): Promise<number> {
  const deleted = await db
    .delete(schema.askTurns)
    .where(lt(schema.askTurns.expiresAt, cutoff))
    .returning({ attemptId: schema.askTurns.attemptId });
  return deleted.length;
}
