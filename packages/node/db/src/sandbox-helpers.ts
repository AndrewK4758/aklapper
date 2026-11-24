import { type CadenceGateVerdict, type CadenceTurn } from '@aklapper/core';
import { asc, eq } from 'drizzle-orm';

import type { AppDatabase } from './client.ts';
import * as schema from './schema.ts';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function mapSandboxTurnRow(row: typeof schema.sandboxTurns.$inferSelect): CadenceTurn {
  return {
    id: row.id,
    phase:
      row.phase === 'triage' ||
      row.phase === 'spec' ||
      row.phase === 'build' ||
      row.phase === 'gate'
        ? row.phase
        : 'build',
    agentName: row.agentName,
    status:
      row.status === 'pending' ||
      row.status === 'running' ||
      row.status === 'completed' ||
      row.status === 'failed'
        ? row.status
        : 'completed',
    summary: typeof row.payloadJson['summary'] === 'string' ? row.payloadJson['summary'] : '',
    latencyMs: row.latencyMs,
    createdAt: row.createdAt.toISOString(),
  };
}

export function normalizeGateVerdict(value: string): CadenceGateVerdict {
  return value === 'approved' || value === 'rejected' ? value : 'pending';
}

export async function updateSandboxRunGateVerdictRow(
  db: AppDatabase,
  runId: string,
  verdict: CadenceGateVerdict,
): Promise<{
  run: typeof schema.sandboxRuns.$inferSelect;
  turns: CadenceTurn[];
} | null> {
  if (!UUID_PATTERN.test(runId)) return null;

  const [updated] = await db
    .update(schema.sandboxRuns)
    .set({ gateVerdict: verdict })
    .where(eq(schema.sandboxRuns.id, runId))
    .returning();

  if (!updated) return null;

  const turnRows = await db
    .select()
    .from(schema.sandboxTurns)
    .where(eq(schema.sandboxTurns.runId, updated.id))
    .orderBy(asc(schema.sandboxTurns.id));

  return {
    run: updated,
    turns: turnRows.map(mapSandboxTurnRow),
  };
}
