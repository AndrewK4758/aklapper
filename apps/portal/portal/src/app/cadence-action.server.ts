import { type AppErrorCode, CadenceRunRequestSchema, type QuotaStatus } from '@aklapper/core';
import { classifyServerError } from '@aklapper/core/server-errors';
import {
  approveSandboxRunSpecForSession,
  clearSandboxRunsForSession,
  cloneCachedSandboxRunForSession,
  createPendingSandboxRunWithQuota,
  findCachedSandboxRun,
  getQuotaStatusForSession,
  getSharedDb,
  GoldenRunImmutableError,
  updateSandboxRunGateVerdictForSession,
} from '@aklapper/db';
import {
  approveCadenceSpecGate,
  classifyGrpcError,
  createCadenceRun,
  isFallbackTransportError,
  submitCadenceGateVerdict,
} from '@aklapper/node-runtime/grpc';
import { logDiagnosticError, type SsrStructuredLogger } from '@aklapper/node-runtime/ssr/stream';
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

function logCadenceTransportBranch(
  logger: SsrStructuredLogger,
  branch: 'grpc_primary' | 'pg19_fallback_transport_unavailable' | 'pg19_fallback_unconfigured',
  intent: 'run' | 'gate' | 'spec-approve',
  correlationId: string,
): void {
  logger.info(
    {
      seam_type: 'RULE_DIVERGENCE',
      event: 'bff.cadence.transport_branch',
      branch,
      intent,
      correlationId,
    },
    'Selected CADENCE BFF transport branch',
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

export function classifyCadenceActionFailure(
  error: unknown,
  intent: 'run' | 'gate' | 'spec-approve' | 'reset',
  correlationId: string,
  logger: SsrStructuredLogger,
  headers: Record<string, string>,
) {
  const { publicError, diagnostic } = classifyServerError(error, {
    correlationId,
    source: `portal.cadence.${intent}`,
  });
  logDiagnosticError(logger, diagnostic);
  return actionError(
    intent,
    publicError.status,
    publicError.message,
    publicError.code,
    {
      correlationId: publicError.correlationId,
      headers,
    },
    { action: publicError.action },
  );
}

export async function handleCadenceResetAction(ctx: CadenceActionContext) {
  const { sessionId, correlationId, logger, headers } = ctx;
  try {
    await clearSandboxRunsForSession(getSharedDb(), sessionId);
    return data<PortalCadenceActionResult>({ ok: true, intent: 'reset' }, { status: 200, headers });
  } catch (error) {
    return classifyCadenceActionFailure(error, 'reset', correlationId, logger, headers);
  }
}

export async function handleCadenceGateAction(formData: FormData, ctx: CadenceActionContext) {
  const { sessionId, correlationId, logger, headers, cadenceDemoUrl } = ctx;
  const runId = String(formData.get('runId') ?? '').trim();
  const rawVerdict = String(formData.get('verdict') ?? '').trim();

  if (!UUID_RE.test(runId) || (rawVerdict !== 'approved' && rawVerdict !== 'rejected')) {
    return actionError('gate', 400, 'Invalid runId or gate verdict.', 'ERR_VALIDATION', ctx);
  }

  if (cadenceDemoUrl) {
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
      logCadenceTransportBranch(logger, 'grpc_primary', 'gate', correlationId);
      return data<PortalCadenceActionResult>(
        { ok: true, intent: 'gate', run: res.run },
        { status: 200, headers },
      );
    } catch (error) {
      const failure = classifyGrpcError(error, {
        correlationId,
        source: 'portal.cadence.gate',
        logger,
      });
      if (!isFallbackTransportError(failure)) {
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
      logCadenceTransportBranch(
        logger,
        'pg19_fallback_transport_unavailable',
        'gate',
        correlationId,
      );
    }
  } else {
    logCadenceTransportBranch(logger, 'pg19_fallback_unconfigured', 'gate', correlationId);
  }

  try {
    const db = getSharedDb();
    const result = await updateSandboxRunGateVerdictForSession(db, runId, rawVerdict, sessionId);
    if (result.outcome === 'not-found') {
      return actionError('gate', 404, 'Sandbox run not found.', 'ERR_NOT_FOUND', ctx);
    }
    if (result.outcome === 'forbidden') {
      logGateUnsound(runId, 'gate_session_mismatch');
      return actionError(
        'gate',
        403,
        'Sandbox run belongs to a different session.',
        'ERR_FORBIDDEN',
        ctx,
      );
    }
    if (result.outcome === 'conflict') {
      return actionError(
        'gate',
        409,
        `Run is currently "${result.status}" and cannot accept a gate verdict yet.`,
        'ERR_CONSTRAINT',
        ctx,
      );
    }

    return data<PortalCadenceActionResult>(
      { ok: true, intent: 'gate', run: result.run },
      { status: 200, headers },
    );
  } catch (error) {
    if (error instanceof GoldenRunImmutableError) {
      logger.warn(
        {
          seam_type: 'UNSOUND_CONDITION',
          event: 'cadence.gate.golden_mutation_blocked',
          runId: error.runId,
          correlationId,
        },
        'Blocked portal gate update against read-only Golden showcase run',
      );
      return actionError(
        'gate',
        409,
        'Golden showcase runs are read-only and cannot be mutated.',
        'ERR_CONSTRAINT',
        ctx,
        { action: 'Run your own prompt to test gate approvals.' },
      );
    }
    return classifyCadenceActionFailure(error, 'gate', correlationId, logger, headers);
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

  if (cadenceDemoUrl) {
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
      logCadenceTransportBranch(logger, 'grpc_primary', 'spec-approve', correlationId);
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
        logger,
      });
      if (!isFallbackTransportError(failure)) {
        return actionError(
          'spec-approve',
          failure.publicError.status,
          failure.publicError.message,
          failure.publicError.code,
          ctx,
          { action: failure.publicError.action },
        );
      }
      logCadenceTransportBranch(
        logger,
        'pg19_fallback_transport_unavailable',
        'spec-approve',
        correlationId,
      );
    }
  } else {
    logCadenceTransportBranch(logger, 'pg19_fallback_unconfigured', 'spec-approve', correlationId);
  }

  try {
    const db = getSharedDb();
    const result = await approveSandboxRunSpecForSession(db, runId, sessionId);
    if (result.outcome === 'not-found') {
      return actionError('spec-approve', 404, 'Sandbox run not found.', 'ERR_NOT_FOUND', ctx);
    }
    if (result.outcome === 'forbidden') {
      return actionError(
        'spec-approve',
        403,
        'Sandbox run belongs to a different session.',
        'ERR_FORBIDDEN',
        ctx,
      );
    }
    if (result.outcome === 'conflict') {
      return actionError(
        'spec-approve',
        409,
        `Run is currently "${result.status}" and is not awaiting spec approval.`,
        'ERR_CONSTRAINT',
        ctx,
      );
    }

    const quota = await getQuotaStatusForSession(db, 'guest', sessionId);
    return data<PortalCadenceActionResult>(
      { ok: true, intent: 'spec-approve', run: { ...result.run, quota }, quota },
      { status: 202, headers },
    );
  } catch (error) {
    if (error instanceof GoldenRunImmutableError) {
      return actionError(
        'spec-approve',
        409,
        'Golden showcase runs are read-only and cannot be mutated.',
        'ERR_CONSTRAINT',
        ctx,
      );
    }
    return classifyCadenceActionFailure(error, 'spec-approve', correlationId, logger, headers);
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

  const resolvedMode = validatedReq.data.mode ?? 'fast';

  if (cadenceDemoUrl) {
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
      logCadenceTransportBranch(logger, 'grpc_primary', 'run', correlationId);
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
        logger,
      });
      if (!isFallbackTransportError(failure)) {
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
      logCadenceTransportBranch(
        logger,
        'pg19_fallback_transport_unavailable',
        'run',
        correlationId,
      );
    }
  } else {
    logCadenceTransportBranch(logger, 'pg19_fallback_unconfigured', 'run', correlationId);
  }

  // Fallback ONLY when CADENCE_DEMO_URL is unset or transport failed with Unavailable/DeadlineExceeded.
  try {
    const db = getSharedDb();
    const cacheLookup = await findCachedSandboxRun(db, {
      sessionId,
      presetSlug,
      mode: resolvedMode,
      prompt: validatedReq.data.prompt,
    });
    if (resolvedMode === 'fast' && !requireSpecApproval && cacheLookup.sourceRun) {
      const cloned = await cloneCachedSandboxRunForSession(
        db,
        { run: cacheLookup.sourceRun, turns: cacheLookup.sourceTurns },
        {
          sessionId,
          ipHash: 'portal-ssr',
          presetSlug,
          prompt: validatedReq.data.prompt,
          promptHash: cacheLookup.promptHash,
        },
      );
      const quota = await getQuotaStatusForSession(db, 'guest', sessionId);
      return data<PortalCadenceActionResult>(
        { ok: true, intent: 'run', run: { ...cloned, quota }, quota },
        { status: 201, headers },
      );
    }

    const initResult = await createPendingSandboxRunWithQuota(db, {
      role: 'guest',
      sessionId,
      ipHash: 'portal-ssr',
      presetSlug,
      prompt: validatedReq.data.prompt,
      mode: resolvedMode,
      promptHash: cacheLookup.promptHash,
      estimatedTokens: 800,
      ...(requireSpecApproval ? { requireSpecApproval: true } : {}),
    });

    if (!initResult.allowed) {
      return data<PortalCadenceActionResult>(
        {
          ok: false,
          intent: 'run',
          error: 'Session or daily CADENCE guest quota exceeded.',
          code: 'ERR_RATE_LIMITED',
          action: 'Wait a moment and submit again.',
          correlationId,
          quota: initResult.quota,
        },
        { status: 429, headers },
      );
    }

    return data<PortalCadenceActionResult>(
      { ok: true, intent: 'run-init', run: initResult.run, quota: initResult.quota },
      { status: 202, headers },
    );
  } catch (error) {
    return classifyCadenceActionFailure(error, 'run', correlationId, logger, headers);
  }
}
