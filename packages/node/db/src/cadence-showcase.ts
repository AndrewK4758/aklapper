import { createHash } from 'node:crypto';

import {
  buildCadencePresetRevisionInput,
  buildCadencePromptHashInput,
  type CadenceRunMode,
  type CadenceRunResult,
  normalizeCadencePrompt,
} from '@aklapper/core';
import { and, asc, desc, eq, inArray, isNotNull } from 'drizzle-orm';

import type { AppDatabase } from './client.ts';
import { mapSandboxRunResult } from './sandbox-helpers.ts';
import * as schema from './schema.ts';

function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function computeCadencePresetRevisionHash(
  expectedKind?: string | null,
  starterArtifactHtml?: string | null,
): string {
  const kind = expectedKind?.trim() ?? '';
  const html = starterArtifactHtml ?? '';
  if (!kind && !html) {
    return '';
  }
  return sha256Hex(buildCadencePresetRevisionInput(kind, html));
}

export function computeCadencePromptHash(input: {
  readonly presetSlug: string;
  readonly presetRevisionHash: string;
  readonly mode: CadenceRunMode;
  readonly prompt: string;
}): string {
  return sha256Hex(buildCadencePromptHashInput(input));
}

/**
 * Fail-closed local-dev unlimited quota bypass matching Go `llm.IsDevUnlimitedEnabled()`. Returns
 * true ONLY when `AI_DEV_UNLIMITED=true` AND neither `NODE_ENV` nor `APP_ENV` is `production` AND
 * `AI_PROVIDER` is not `vertex`.
 */
export function isNodeDevUnlimitedEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  const raw = env['AI_DEV_UNLIMITED']?.trim().toLowerCase();
  if (raw !== 'true') {
    return false;
  }
  const nodeEnv = env['NODE_ENV']?.trim().toLowerCase();
  const appEnv = env['APP_ENV']?.trim().toLowerCase();
  const provider = env['AI_PROVIDER']?.trim().toLowerCase();
  const isProd = nodeEnv === 'production' || appEnv === 'production';
  const isVertex = provider === 'vertex';
  if (isProd || isVertex) {
    const reason =
      isProd && isVertex
        ? 'production_and_vertex'
        : isVertex
          ? 'vertex_provider'
          : 'production_env';
    console.warn(
      JSON.stringify({
        seam_type: 'UNSOUND_CONDITION',
        event: 'cadence.config.dev_unlimited_refused',
        reason,
      }),
    );
    return false;
  }
  return true;
}

export async function listGoldenSandboxRuns(db: AppDatabase): Promise<CadenceRunResult[]> {
  const runs = await db
    .select()
    .from(schema.sandboxRuns)
    .where(eq(schema.sandboxRuns.isGolden, true))
    .orderBy(asc(schema.sandboxRuns.id));

  if (runs.length === 0) {
    return [];
  }

  const runIds = runs.map(r => r.id);
  const allTurnRows = await db
    .select()
    .from(schema.sandboxTurns)
    .where(inArray(schema.sandboxTurns.runId, runIds))
    .orderBy(asc(schema.sandboxTurns.id));

  const turnsByRun = new Map<string, (typeof schema.sandboxTurns.$inferSelect)[]>();
  for (const row of allTurnRows) {
    const list = turnsByRun.get(row.runId) ?? [];
    list.push(row);
    turnsByRun.set(row.runId, list);
  }

  return runs.map(run => mapSandboxRunResult(run, turnsByRun.get(run.id) ?? []));
}

export interface FindCachedSandboxRunInput {
  readonly sessionId: string;
  readonly presetSlug?: string;
  readonly mode: CadenceRunMode;
  readonly prompt: string;
}

export interface FindCachedSandboxRunResult {
  readonly promptHash: string;
  readonly scope: 'preset_global_hit' | 'session_private_hit' | 'miss';
  readonly sourceRun: typeof schema.sandboxRuns.$inferSelect | null;
  readonly sourceTurns: readonly (typeof schema.sandboxTurns.$inferSelect)[];
}

export async function findCachedSandboxRun(
  db: AppDatabase,
  input: FindCachedSandboxRunInput,
): Promise<FindCachedSandboxRunResult> {
  const presetSlug = input.presetSlug?.trim() || 'custom';
  const trimmedSession = input.sessionId.trim();

  let presetRevisionHash = '';
  let isSeededPresetPrompt = false;

  if (presetSlug && presetSlug !== 'custom' && presetSlug !== '__custom__') {
    const [preset] = await db
      .select()
      .from(schema.cadencePresets)
      .where(eq(schema.cadencePresets.slug, presetSlug))
      .limit(1);
    if (preset) {
      presetRevisionHash = computeCadencePresetRevisionHash(
        preset.expectedKind,
        preset.starterArtifactHtml,
      );
      isSeededPresetPrompt =
        normalizeCadencePrompt(input.prompt) === normalizeCadencePrompt(preset.starterPrompt);
    }
  }

  const promptHash = computeCadencePromptHash({
    presetSlug,
    presetRevisionHash,
    mode: input.mode,
    prompt: input.prompt,
  });

  const baseFilters = [
    eq(schema.sandboxRuns.promptHash, promptHash),
    eq(schema.sandboxRuns.status, 'ready'),
    isNotNull(schema.sandboxRuns.promptHash),
    inArray(
      schema.sandboxRuns.executionMode,
      isSeededPresetPrompt ? ['live', 'fast', 'golden'] : ['live', 'fast'],
    ),
  ];

  if (!isSeededPresetPrompt) {
    if (!trimmedSession) {
      return { promptHash, scope: 'miss', sourceRun: null, sourceTurns: [] };
    }
    baseFilters.push(eq(schema.sandboxRuns.sessionId, trimmedSession));
  }

  const [sourceRun] = await db
    .select()
    .from(schema.sandboxRuns)
    .where(and(...baseFilters))
    .orderBy(desc(schema.sandboxRuns.isGolden), desc(schema.sandboxRuns.createdAt))
    .limit(1);

  if (!sourceRun) {
    return { promptHash, scope: 'miss', sourceRun: null, sourceTurns: [] };
  }

  const sourceTurns = await db
    .select()
    .from(schema.sandboxTurns)
    .where(eq(schema.sandboxTurns.runId, sourceRun.id))
    .orderBy(asc(schema.sandboxTurns.id));

  return {
    promptHash,
    scope: isSeededPresetPrompt ? 'preset_global_hit' : 'session_private_hit',
    sourceRun,
    sourceTurns,
  };
}

export async function cloneCachedSandboxRunForSession(
  db: AppDatabase,
  source: {
    readonly run: typeof schema.sandboxRuns.$inferSelect;
    readonly turns: readonly (typeof schema.sandboxTurns.$inferSelect)[];
  },
  target: {
    readonly sessionId: string;
    readonly ipHash: string;
    readonly presetSlug?: string;
    readonly prompt: string;
    readonly promptHash: string;
  },
): Promise<CadenceRunResult> {
  const trimmedSession = target.sessionId.trim() || 'anonymous';
  const menuSlug = target.presetSlug?.trim() || source.run.menuSlug || 'custom';

  return db.transaction(async tx => {
    const [clonedRun] = await tx
      .insert(schema.sandboxRuns)
      .values({
        sessionId: trimmedSession,
        ipHash: target.ipHash,
        menuSlug,
        prompt: target.prompt,
        status: 'ready',
        gateVerdict: 'pending',
        tokensIn: 0,
        tokensOut: 0,
        artifactHtml: source.run.artifactHtml ?? '',
        isGolden: false,
        promptHash: target.promptHash,
        executionMode: 'cached',
        specJson: source.run.specJson ?? null,
        gateAuditJson: source.run.gateAuditJson ?? null,
      })
      .returning();

    if (!clonedRun) {
      throw new Error('Failed to clone cached sandbox run in Postgres');
    }

    const turnValues = source.turns.map(turn => ({
      runId: clonedRun.id,
      phase: turn.phase,
      agentName: turn.agentName,
      status: turn.status,
      payloadJson: { ...turn.payloadJson },
      latencyMs: turn.latencyMs,
    }));

    const insertedTurns =
      turnValues.length > 0
        ? await tx.insert(schema.sandboxTurns).values(turnValues).returning()
        : [];

    return mapSandboxRunResult(clonedRun, insertedTurns);
  });
}
