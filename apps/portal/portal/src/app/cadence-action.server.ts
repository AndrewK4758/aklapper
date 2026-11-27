import { type AppErrorCode, CadenceRunRequestSchema, type QuotaStatus } from '@aklapper/core';
import {
  approveCadenceSpecGate,
  classifyGrpcError,
  clearCadenceSessionRuns,
  createCadenceRun,
  submitCadenceGateVerdict,
} from '@aklapper/node-runtime/grpc';
import type { SsrStructuredLogger } from '@aklapper/node-runtime/ssr/stream';
import { data } from 'react-router';

import type { PortalCadenceActionResult } from '#pages/cadence';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface CadenceActionContext {
  readonly sessionId: string;
  readonly correlationId: string;
  readonly logger: SsrStructuredLogger;
  readonly headers: Record<string, string>;
  readonly cadenceDemoUrl: string | undefined;
}

function resolveInitTimeoutMs(mode: 'fast' | 'llm'): number {
  const configured = Number(process.env['CADENCE_DEMO_INIT_TIMEOUT_MS']);
  if (Number.isFinite(configured) && configured >= 250) {
    return configured;
  }
  return mode === 'fast' ? 2_000 : 12_000;
}

function logGateUnsound(runId: string, reason: string): void {
  console.error(
    JSON.stringify({
      seam_type: 'UNSOUND_CONDITION',
      event: 'cadence.stream.session_mismatch_or_missing',
      severity: 'critical',
      service: 'portal-cadence-action',
      runId,
      reason,
      timestamp: new Date().toISOString(),
    }),
  );
}

function actionError(
  intent: 'run' | 'gate' | 'spec-approve' | 'reset',
  status: number,
  error: string,
  code: AppErrorCode,
  ctx: Pick<CadenceActionContext, 'correlationId' | 'headers'>,
  extra?: { readonly action?: string; readonly quota?: QuotaStatus },
) {
  return data<PortalCadenceActionResult>(
    { ok: false, intent, error, code, correlationId: ctx.correlationId, ...extra },
    { status, headers: ctx.headers },
  );
}

function unavailableResponse(
  intent: 'run' | 'gate' | 'spec-approve' | 'reset',
  ctx: CadenceActionContext,
) {
  return actionError(
    intent,
    503,
    'Upstream service unreachable.',
    'ERR_UPSTREAM_UNAVAILABLE',
    ctx,
    { action: 'Retry shortly or go home.' },
  );
}

export async function handleCadenceResetAction(ctx: CadenceActionContext) {
  const { sessionId, correlationId, logger, headers, cadenceDemoUrl } = ctx;
  if (!cadenceDemoUrl) {
    return unavailableResponse('reset', ctx);
  }
  try {
    await clearCadenceSessionRuns({
      baseUrl: cadenceDemoUrl,
      internalAuth: { role: 'guest', subject: sessionId },
      correlationId,
      timeoutMs: 6_000,
      logger,
    });
    return data<PortalCadenceActionResult>({ ok: true, intent: 'reset' }, { status: 200, headers });
  } catch (error) {
    const failure = classifyGrpcError(error, {
      correlationId,
      source: 'portal.cadence.reset',
      normalizeUnavailableStatus: 503,
      logger,
    });
    return actionError(
      'reset',
      failure.publicError.status,
      failure.publicError.message,
      failure.publicError.code,
      ctx,
      { action: failure.publicError.action },
    );
  }
}

export async function handleCadenceGateAction(formData: FormData, ctx: CadenceActionContext) {
  const { sessionId, correlationId, logger, headers, cadenceDemoUrl } = ctx;
  const runId = String(formData.get('runId') ?? '').trim();
  const rawVerdict = String(formData.get('verdict') ?? '').trim();

  if (!UUID_RE.test(runId) || (rawVerdict !== 'approved' && rawVerdict !== 'rejected')) {
    return actionError('gate', 400, 'Invalid runId or gate verdict.', 'ERR_VALIDATION', ctx);
  }
  if (!cadenceDemoUrl) {
    return unavailableResponse('gate', ctx);
  }

  try {
    const res = await submitCadenceGateVerdict(
      {
        baseUrl: cadenceDemoUrl,
        internalAuth: { role: 'guest', subject: sessionId },
        correlationId,
        timeoutMs: 6_000,
        logger,
      },
      runId,
      rawVerdict,
    );
    return data<PortalCadenceActionResult>(
      { ok: true, intent: 'gate', run: res.run },
      { status: 200, headers },
    );
  } catch (error) {
    const failure = classifyGrpcError(error, {
      correlationId,
      source: 'portal.cadence.gate',
      normalizeUnavailableStatus: 503,
      logger,
    });
    if (failure.publicError.status === 403) {
      logGateUnsound(runId, 'upstream_gate_forbidden');
    }
    return actionError(
      'gate',
      failure.publicError.status,
      failure.publicError.message,
      failure.publicError.code,
      ctx,
      { action: failure.publicError.action },
    );
  }
}

export async function handleCadenceSpecApproveAction(
  formData: FormData,
  ctx: CadenceActionContext,
) {
  const { sessionId, correlationId, logger, headers, cadenceDemoUrl } = ctx;
  const runId = String(formData.get('runId') ?? '').trim();

  if (!UUID_RE.test(runId)) {
    return actionError(
      'spec-approve',
      400,
      'Invalid runId for spec approval.',
      'ERR_VALIDATION',
      ctx,
    );
  }
  if (!cadenceDemoUrl) {
    return unavailableResponse('spec-approve', ctx);
  }

  try {
    const res = await approveCadenceSpecGate(
      {
        baseUrl: cadenceDemoUrl,
        internalAuth: { role: 'guest', subject: sessionId },
        correlationId,
        timeoutMs: 8_000,
        logger,
      },
      runId,
    );
    return data<PortalCadenceActionResult>(
      {
        ok: true,
        intent: 'spec-approve',
        run: res.run,
        ...(res.quota ? { quota: res.quota } : {}),
      },
      { status: 202, headers },
    );
  } catch (error) {
    const failure = classifyGrpcError(error, {
      correlationId,
      source: 'portal.cadence.spec-approve',
      normalizeUnavailableStatus: 503,
      logger,
    });
    return actionError(
      'spec-approve',
      failure.publicError.status,
      failure.publicError.message,
      failure.publicError.code,
      ctx,
      { action: failure.publicError.action },
    );
  }
}

export async function handleCadenceRunAction(formData: FormData, ctx: CadenceActionContext) {
  const { sessionId, correlationId, logger, headers, cadenceDemoUrl } = ctx;
  const prompt = String(formData.get('prompt') ?? '').trim();
  const rawPreset = String(formData.get('presetSlug') ?? '').trim();
  const presetSlug = rawPreset && rawPreset !== '__custom__' ? rawPreset : 'custom';
  const rawMode = String(formData.get('mode') ?? 'llm').trim();
  const requireSpecApproval = String(formData.get('requireSpecApproval') ?? '').trim() === 'true';

  const validatedReq = CadenceRunRequestSchema.safeParse({
    prompt,
    presetSlug,
    sessionId,
    mode: rawMode,
    deferExecution: true,
    ...(requireSpecApproval ? { requireSpecApproval: true } : {}),
  });
  if (!validatedReq.success) {
    return data<PortalCadenceActionResult>(
      {
        ok: false,
        intent: 'run',
        error: 'Prompt must be 4..1200 characters and mode must be fast or llm.',
        code: 'ERR_VALIDATION',
        correlationId,
      },
      { status: 400, headers },
    );
  }

  if (!cadenceDemoUrl) {
    return unavailableResponse('run', ctx);
  }

  const resolvedMode = validatedReq.data.mode ?? 'fast';
  try {
    const res = await createCadenceRun(
      {
        baseUrl: cadenceDemoUrl,
        internalAuth: { role: 'guest', subject: sessionId },
        correlationId,
        timeoutMs: resolveInitTimeoutMs(resolvedMode),
        logger,
      },
      {
        prompt: validatedReq.data.prompt,
        presetSlug,
        mode: resolvedMode,
        deferExecution: true,
        ...(requireSpecApproval ? { requireSpecApproval: true } : {}),
      },
    );
    const quota = res.run.quota;
    if (res.createdImmediately || !res.run.runStatus || res.run.runStatus === 'ready') {
      return data<PortalCadenceActionResult>(
        {
          ok: true,
          intent: 'run',
          run: res.run,
          ...(quota ? { quota } : {}),
        },
        { status: 201, headers },
      );
    }
    return data<PortalCadenceActionResult>(
      {
        ok: true,
        intent: 'run-init',
        run: res.run,
        ...(quota ? { quota } : {}),
      },
      { status: 202, headers },
    );
  } catch (error) {
    const failure = classifyGrpcError(error, {
      correlationId,
      source: 'portal.cadence.run',
      normalizeUnavailableStatus: 503,
      logger,
    });
    return actionError(
      'run',
      failure.publicError.status,
      failure.publicError.message,
      failure.publicError.code,
      ctx,
      {
        action: failure.publicError.action,
        ...(failure.quota ? { quota: failure.quota } : {}),
      },
    );
  }
}
