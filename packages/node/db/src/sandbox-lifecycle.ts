import {
  type CadenceGateVerdict,
  type CadenceRunMode,
  type CadenceRunResult,
  type CadenceTurn,
  type CadenceTurnPhase,
  type CadenceTurnStatus,
  type QuotaStatus,
  QuotaStatusSchema,
  type Role,
} from '@aklapper/core';
import { and, asc, eq, sql } from 'drizzle-orm';

import type { AppDatabase } from './client.ts';
import {
  DEFAULT_QUOTA_BY_ROLE,
  extractRunModeFromTurnRows,
  mapSandboxRunResult,
  mapSandboxTurnRow,
  SANDBOX_UUID_PATTERN,
} from './sandbox-helpers.ts';
import * as schema from './schema.ts';

const CHORD_TURN_SPECS: ReadonlyArray<{
  readonly phase: CadenceTurnPhase;
  readonly agentName: string;
}> = [
  { phase: 'triage', agentName: 'chord-triage' },
  { phase: 'spec', agentName: 'chord-spec' },
  { phase: 'build', agentName: 'chord-builder' },
  { phase: 'gate', agentName: 'chord-gate' },
];

export interface CreatePendingSandboxRunInput {
  readonly role: Role;
  readonly sessionId: string;
  readonly ipHash: string;
  readonly presetSlug?: string;
  readonly prompt: string;
  readonly mode: CadenceRunMode;
  readonly estimatedTokens?: number;
}

export type CreatePendingSandboxRunResult =
  | { readonly allowed: false; readonly quota: QuotaStatus; readonly run: null }
  | { readonly allowed: true; readonly quota: QuotaStatus; readonly run: CadenceRunResult };

export async function createPendingSandboxRunWithQuota(
  db: AppDatabase,
  input: CreatePendingSandboxRunInput,
): Promise<CreatePendingSandboxRunResult> {
  const trimmedSession = input.sessionId.trim() || 'anonymous';
  const tokensDelta = Math.max(0, input.estimatedTokens ?? 800);
  const presetSlug = input.presetSlug?.trim() || 'custom';
  const today = new Date().toISOString().slice(0, 10);
  const sessionKey = `session:${trimmedSession}`;
  const globalKey = `global:${today}`;

  return db.transaction(async tx => {
    const [policyRow] = await tx
      .select()
      .from(schema.quotaPolicies)
      .where(eq(schema.quotaPolicies.role, input.role))
      .limit(1);
    const policy = policyRow ?? DEFAULT_QUOTA_BY_ROLE[input.role];
    const maxTokens = policy.maxTokensPerRun * policy.maxTurnsPerSession;

    for (const scopeKey of [sessionKey, globalKey]) {
      await tx
        .insert(schema.rateLimitBuckets)
        .values({ scopeKey, turnsUsed: 0, tokensUsed: 0 })
        .onConflictDoNothing({ target: schema.rateLimitBuckets.scopeKey });
    }

    const [sessionRow] = await tx
      .select()
      .from(schema.rateLimitBuckets)
      .where(eq(schema.rateLimitBuckets.scopeKey, sessionKey))
      .limit(1)
      .for('update');
    const [globalRow] = await tx
      .select()
      .from(schema.rateLimitBuckets)
      .where(eq(schema.rateLimitBuckets.scopeKey, globalKey))
      .limit(1)
      .for('update');

    const sessionTurns = sessionRow?.turnsUsed ?? 0;
    const sessionTokens = sessionRow?.tokensUsed ?? 0;
    const globalTokens = globalRow?.tokensUsed ?? 0;

    if (
      sessionTurns + 1 > policy.maxTurnsPerSession ||
      tokensDelta > policy.maxTokensPerRun ||
      globalTokens + tokensDelta > policy.maxDailyGlobalTokens
    ) {
      return {
        allowed: false,
        quota: QuotaStatusSchema.parse({
          role: input.role,
          turnsUsed: sessionTurns,
          maxTurns: policy.maxTurnsPerSession,
          tokensUsed: sessionTokens,
          maxTokens,
        }),
        run: null,
      };
    }

    await tx
      .update(schema.rateLimitBuckets)
      .set({
        turnsUsed: sql`${schema.rateLimitBuckets.turnsUsed} + 1`,
        tokensUsed: sql`${schema.rateLimitBuckets.tokensUsed} + ${tokensDelta}`,
      })
      .where(eq(schema.rateLimitBuckets.scopeKey, sessionKey));

    await tx
      .update(schema.rateLimitBuckets)
      .set({
        turnsUsed: sql`${schema.rateLimitBuckets.turnsUsed} + 1`,
        tokensUsed: sql`${schema.rateLimitBuckets.tokensUsed} + ${tokensDelta}`,
      })
      .where(eq(schema.rateLimitBuckets.scopeKey, globalKey));

    const [insertedRun] = await tx
      .insert(schema.sandboxRuns)
      .values({
        sessionId: trimmedSession,
        ipHash: input.ipHash,
        menuSlug: presetSlug,
        prompt: input.prompt,
        status: 'pending',
        gateVerdict: 'pending',
        tokensIn: 0,
        tokensOut: 0,
        artifactHtml: '',
      })
      .returning();

    if (!insertedRun) {
      throw new Error('Failed to create pending sandbox run in Postgres');
    }

    const turnValues = CHORD_TURN_SPECS.map(spec => ({
      runId: insertedRun.id,
      phase: spec.phase,
      agentName: spec.agentName,
      status: 'pending',
      payloadJson:
        spec.phase === 'triage'
          ? { summary: 'Queued in CHORD pipeline', presetSlug, mode: input.mode }
          : { summary: 'Queued' },
      latencyMs: 0,
    }));

    const insertedTurns = await tx.insert(schema.sandboxTurns).values(turnValues).returning();
    const quota = QuotaStatusSchema.parse({
      role: input.role,
      turnsUsed: sessionTurns + 1,
      maxTurns: policy.maxTurnsPerSession,
      tokensUsed: sessionTokens + tokensDelta,
      maxTokens,
    });

    return {
      allowed: true,
      quota,
      run: mapSandboxRunResult(insertedRun, insertedTurns, quota),
    };
  });
}

export async function getSandboxRunWithTurnsById(
  db: AppDatabase,
  runId: string,
): Promise<{ readonly sessionId: string; readonly run: CadenceRunResult } | null> {
  if (!SANDBOX_UUID_PATTERN.test(runId)) return null;

  const [runRow] = await db
    .select()
    .from(schema.sandboxRuns)
    .where(eq(schema.sandboxRuns.id, runId))
    .limit(1);
  if (!runRow) return null;

  const turnRows = await db
    .select()
    .from(schema.sandboxTurns)
    .where(eq(schema.sandboxTurns.runId, runRow.id))
    .orderBy(asc(schema.sandboxTurns.id));

  return {
    sessionId: runRow.sessionId,
    run: mapSandboxRunResult(runRow, turnRows),
  };
}

export async function claimPendingSandboxRun(
  db: AppDatabase,
  runId: string,
  sessionId: string,
): Promise<{ readonly run: CadenceRunResult; readonly mode: CadenceRunMode } | null> {
  if (!SANDBOX_UUID_PATTERN.test(runId)) return null;

  const [claimed] = await db
    .update(schema.sandboxRuns)
    .set({ status: 'running' })
    .where(
      and(
        eq(schema.sandboxRuns.id, runId),
        eq(schema.sandboxRuns.sessionId, sessionId),
        eq(schema.sandboxRuns.status, 'pending'),
      ),
    )
    .returning();

  if (!claimed) return null;

  const turnRows = await db
    .select()
    .from(schema.sandboxTurns)
    .where(eq(schema.sandboxTurns.runId, claimed.id))
    .orderBy(asc(schema.sandboxTurns.id));

  const mode = extractRunModeFromTurnRows(turnRows) ?? 'fast';
  return {
    run: mapSandboxRunResult(claimed, turnRows),
    mode,
  };
}

export interface UpdateSandboxTurnInput {
  readonly runId: string;
  readonly phase: CadenceTurnPhase;
  readonly status: CadenceTurnStatus;
  readonly summary: string;
  readonly latencyMs: number;
  readonly payload?: Record<string, unknown>;
}

export async function updateSandboxTurnRow(
  db: AppDatabase,
  input: UpdateSandboxTurnInput,
): Promise<CadenceTurn | null> {
  if (!SANDBOX_UUID_PATTERN.test(input.runId)) return null;

  const patch: Record<string, unknown> = {
    ...input.payload,
    summary: input.summary,
  };

  const [updated] = await db
    .update(schema.sandboxTurns)
    .set({
      status: input.status,
      latencyMs: input.latencyMs,
      payloadJson: sql`COALESCE(${schema.sandboxTurns.payloadJson}, '{}'::jsonb) || ${JSON.stringify(patch)}::jsonb`,
    })
    .where(
      and(eq(schema.sandboxTurns.runId, input.runId), eq(schema.sandboxTurns.phase, input.phase)),
    )
    .returning();

  return updated ? mapSandboxTurnRow(updated) : null;
}

export async function completeSandboxRunRow(
  db: AppDatabase,
  input: {
    readonly runId: string;
    readonly tokensIn: number;
    readonly tokensOut: number;
    readonly artifactHtml: string;
  },
): Promise<CadenceRunResult | null> {
  if (!SANDBOX_UUID_PATTERN.test(input.runId)) return null;

  const [updated] = await db
    .update(schema.sandboxRuns)
    .set({
      status: 'ready',
      tokensIn: input.tokensIn,
      tokensOut: input.tokensOut,
      artifactHtml: input.artifactHtml,
    })
    .where(eq(schema.sandboxRuns.id, input.runId))
    .returning();

  if (!updated) return null;

  const turnRows = await db
    .select()
    .from(schema.sandboxTurns)
    .where(eq(schema.sandboxTurns.runId, updated.id))
    .orderBy(asc(schema.sandboxTurns.id));

  return mapSandboxRunResult(updated, turnRows);
}

export async function failSandboxRunRow(
  db: AppDatabase,
  runId: string,
  reason: string,
): Promise<void> {
  if (!SANDBOX_UUID_PATTERN.test(runId)) return;

  await db
    .update(schema.sandboxRuns)
    .set({ status: 'failed' })
    .where(eq(schema.sandboxRuns.id, runId));

  if (reason.trim()) {
    await db
      .update(schema.sandboxTurns)
      .set({
        status: 'failed',
        payloadJson: sql`COALESCE(${schema.sandboxTurns.payloadJson}, '{}'::jsonb) || ${JSON.stringify({ summary: reason })}::jsonb`,
      })
      .where(and(eq(schema.sandboxTurns.runId, runId), eq(schema.sandboxTurns.status, 'running')));
  }
}

export type SessionGateVerdictOutcome =
  | { readonly outcome: 'ok'; readonly run: CadenceRunResult }
  | { readonly outcome: 'not-found' }
  | { readonly outcome: 'forbidden' }
  | { readonly outcome: 'conflict'; readonly status: string };

export async function updateSandboxRunGateVerdictForSession(
  db: AppDatabase,
  runId: string,
  verdict: Exclude<CadenceGateVerdict, 'pending'>,
  sessionId: string,
): Promise<SessionGateVerdictOutcome> {
  if (!SANDBOX_UUID_PATTERN.test(runId)) {
    return { outcome: 'not-found' };
  }

  const [existing] = await db
    .select()
    .from(schema.sandboxRuns)
    .where(eq(schema.sandboxRuns.id, runId))
    .limit(1);

  if (!existing) {
    return { outcome: 'not-found' };
  }
  if (existing.sessionId !== sessionId) {
    return { outcome: 'forbidden' };
  }
  if (existing.status !== 'ready') {
    return { outcome: 'conflict', status: existing.status };
  }

  const [updated] = await db
    .update(schema.sandboxRuns)
    .set({ gateVerdict: verdict })
    .where(
      and(
        eq(schema.sandboxRuns.id, runId),
        eq(schema.sandboxRuns.sessionId, sessionId),
        eq(schema.sandboxRuns.status, 'ready'),
      ),
    )
    .returning();

  if (!updated) {
    return { outcome: 'conflict', status: existing.status };
  }

  const turnRows = await db
    .select()
    .from(schema.sandboxTurns)
    .where(eq(schema.sandboxTurns.runId, updated.id))
    .orderBy(asc(schema.sandboxTurns.id));

  return {
    outcome: 'ok',
    run: mapSandboxRunResult(updated, turnRows),
  };
}
