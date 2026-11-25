import {
  CadenceExecutionModeSchema,
  type CadenceGateAudit,
  CadenceGateAuditSchema,
  type CadenceGateVerdict,
  type CadenceRunLifecycleStatus,
  CadenceRunLifecycleStatusSchema,
  type CadenceRunMode,
  type CadenceRunResult,
  CadenceRunResultSchema,
  type CadenceSpecArtifact,
  CadenceSpecArtifactSchema,
  type CadenceTurn,
  type CadenceTurnPayloadValue,
  CadenceTurnPayloadValueSchema,
  type QuotaStatus,
  type Role,
} from '@aklapper/core';
import { and, asc, eq } from 'drizzle-orm';

import type { AppDatabase } from './client.ts';
import * as schema from './schema.ts';

export class GoldenRunImmutableError extends Error {
  readonly status = 409;
  readonly code = 'ERR_CONFLICT';
  readonly runId: string;

  constructor(runId: string) {
    super(`Golden showcase run "${runId}" is read-only and cannot be mutated.`);
    this.name = 'GoldenRunImmutableError';
    this.runId = runId;
  }
}

export const SANDBOX_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const DEFAULT_QUOTA_BY_ROLE: Readonly<
  Record<
    Role,
    { maxTurnsPerSession: number; maxTokensPerRun: number; maxDailyGlobalTokens: number }
  >
> = {
  guest: { maxTurnsPerSession: 10, maxTokensPerRun: 4_000, maxDailyGlobalTokens: 100_000 },
  admin: { maxTurnsPerSession: 100, maxTokensPerRun: 32_000, maxDailyGlobalTokens: 2_000_000 },
};

export function mapSandboxTurnRow(row: typeof schema.sandboxTurns.$inferSelect): CadenceTurn {
  const { summary: rawSummary, ...restPayload } = row.payloadJson;
  const parsedPayload: Record<string, CadenceTurnPayloadValue> = {};
  for (const [key, value] of Object.entries(restPayload)) {
    const parsed = CadenceTurnPayloadValueSchema.safeParse(value);
    if (parsed.success) {
      parsedPayload[key] = parsed.data;
    }
  }
  const hasPayload = Object.keys(parsedPayload).length > 0;
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
    summary: typeof rawSummary === 'string' ? rawSummary : '',
    latencyMs: row.latencyMs,
    ...(hasPayload ? { payload: parsedPayload } : {}),
    createdAt: row.createdAt.toISOString(),
  };
}

export function normalizeGateVerdict(value: string): CadenceGateVerdict {
  return value === 'approved' || value === 'rejected' ? value : 'pending';
}

export function normalizeRunLifecycleStatus(value: string): CadenceRunLifecycleStatus {
  const parsed = CadenceRunLifecycleStatusSchema.safeParse(value);
  return parsed.success ? parsed.data : 'ready';
}

export function extractPresetSlugFromTurnRows(
  turnRows: readonly (typeof schema.sandboxTurns.$inferSelect)[],
  fallbackMenuSlug?: string,
): string | undefined {
  const triageRow = turnRows.find(row => row.phase === 'triage');
  const rawSlug = triageRow?.payloadJson['presetSlug'];
  if (typeof rawSlug === 'string' && rawSlug.trim().length > 0) {
    return rawSlug.trim();
  }
  if (fallbackMenuSlug && fallbackMenuSlug.trim().length > 0 && fallbackMenuSlug !== 'cadence') {
    return fallbackMenuSlug.trim();
  }
  return undefined;
}

export function extractRunModeFromTurnRows(
  turnRows: readonly (typeof schema.sandboxTurns.$inferSelect)[],
): CadenceRunMode | undefined {
  const triageRow = turnRows.find(row => row.phase === 'triage');
  const rawMode = triageRow?.payloadJson['mode'];
  return rawMode === 'fast' || rawMode === 'llm' ? rawMode : undefined;
}

export function mapSandboxRunResult(
  run: typeof schema.sandboxRuns.$inferSelect,
  turnRows: readonly (typeof schema.sandboxTurns.$inferSelect)[],
  quota?: QuotaStatus,
): CadenceRunResult {
  const presetSlug = extractPresetSlugFromTurnRows(turnRows, run.menuSlug);
  const mode = extractRunModeFromTurnRows(turnRows);
  const parsedExecutionMode = CadenceExecutionModeSchema.safeParse(run.executionMode);
  const parsedSpec = run.specJson ? CadenceSpecArtifactSchema.safeParse(run.specJson) : null;
  const parsedGateAudit = run.gateAuditJson
    ? CadenceGateAuditSchema.safeParse(run.gateAuditJson)
    : null;
  const spec: CadenceSpecArtifact | undefined = parsedSpec?.success ? parsedSpec.data : undefined;
  const gateAudit: CadenceGateAudit | undefined = parsedGateAudit?.success
    ? parsedGateAudit.data
    : undefined;

  return CadenceRunResultSchema.parse({
    runId: run.id,
    prompt: run.prompt,
    ...(presetSlug ? { presetSlug } : {}),
    runStatus: normalizeRunLifecycleStatus(run.status),
    ...(mode ? { mode } : {}),
    ...(parsedExecutionMode.success ? { executionMode: parsedExecutionMode.data } : {}),
    isGolden: Boolean(run.isGolden),
    ...(spec ? { spec } : {}),
    ...(gateAudit ? { gateAudit } : {}),
    gateVerdict: normalizeGateVerdict(run.gateVerdict),
    turns: turnRows.map(mapSandboxTurnRow),
    artifactHtml: run.artifactHtml ?? '',
    tokensIn: run.tokensIn,
    tokensOut: run.tokensOut,
    ...(quota ? { quota } : {}),
    createdAt: run.createdAt.toISOString(),
  });
}

export async function updateSandboxRunGateVerdictRow(
  db: AppDatabase,
  runId: string,
  verdict: CadenceGateVerdict,
): Promise<{
  run: typeof schema.sandboxRuns.$inferSelect;
  turns: CadenceTurn[];
} | null> {
  if (!SANDBOX_UUID_PATTERN.test(runId)) return null;

  const [existing] = await db
    .select({ id: schema.sandboxRuns.id, isGolden: schema.sandboxRuns.isGolden })
    .from(schema.sandboxRuns)
    .where(eq(schema.sandboxRuns.id, runId))
    .limit(1);

  if (!existing) return null;
  if (existing.isGolden) {
    console.warn(
      JSON.stringify({
        seam_type: 'UNSOUND_CONDITION',
        event: 'cadence.gate.golden_mutation_blocked',
        runId,
      }),
    );
    throw new GoldenRunImmutableError(runId);
  }

  const [updated] = await db
    .update(schema.sandboxRuns)
    .set({ gateVerdict: verdict })
    .where(and(eq(schema.sandboxRuns.id, runId), eq(schema.sandboxRuns.isGolden, false)))
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
