import {
  type AppErrorCode,
  CadenceRunRequestSchema,
  CadenceRunResultSchema,
  type QuotaStatus,
  QuotaStatusSchema,
} from '@aklapper/core';
import { classifyServerError } from '@aklapper/core/server-errors';
import {
  approveSandboxRunSpecForSession,
  cloneCachedSandboxRunForSession,
  createPendingSandboxRunWithQuota,
  findCachedSandboxRun,
  getQuotaStatusForSession,
  getSharedDb,
  GoldenRunImmutableError,
  updateSandboxRunGateVerdictForSession,
} from '@aklapper/db';
import { proxyJson } from '@aklapper/node-runtime/http';
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

const HTTP_STATUS_ERROR_CODES: Readonly<Record<number, AppErrorCode>> = {
  400: 'ERR_VALIDATION',
  401: 'ERR_UNAUTHORIZED',
  403: 'ERR_FORBIDDEN',
  404: 'ERR_NOT_FOUND',
  409: 'ERR_CONSTRAINT',
  422: 'ERR_VALIDATION',
  429: 'ERR_RATE_LIMITED',
};

function mapHttpStatusToErrorCode(status: number): AppErrorCode {
  return (
    HTTP_STATUS_ERROR_CODES[status] ?? (status >= 500 ? 'ERR_UPSTREAM_UNAVAILABLE' : 'ERR_INTERNAL')
  );
}

function makeUpstreamStatusError(
  status: number,
  message: string,
): Error & { status: number; statusText: string; data: null } {
  return Object.assign(new Error(message), { status, statusText: message, data: null });
}

function actionError(
  intent: 'run' | 'gate' | 'spec-approve',
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
  intent: 'run' | 'gate' | 'spec-approve',
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

export async function handleCadenceGateAction(formData: FormData, ctx: CadenceActionContext) {
  const { sessionId, correlationId, logger, headers, cadenceDemoUrl } = ctx;
  const runId = String(formData.get('runId') ?? '').trim();
  const rawVerdict = String(formData.get('verdict') ?? '').trim();

  if (!UUID_RE.test(runId) || (rawVerdict !== 'approved' && rawVerdict !== 'rejected')) {
    return actionError('gate', 400, 'Invalid runId or gate verdict.', 'ERR_VALIDATION', ctx);
  }

  if (cadenceDemoUrl) {
    let upstream: Awaited<ReturnType<typeof proxyJson<Record<string, unknown>>>>;
    try {
      upstream = await proxyJson<Record<string, unknown>>({
        baseUrl: cadenceDemoUrl,
        path: `/v1/cadence/runs/${encodeURIComponent(runId)}/gate`,
        method: 'POST',
        headers: { 'x-session-id': sessionId, 'X-Correlation-Id': correlationId },
        body: { verdict: rawVerdict },
        timeoutMs: 6_000,
        internalAuth: { role: 'guest', subject: sessionId },
      });
    } catch (error) {
      return classifyCadenceActionFailure(error, 'gate', correlationId, logger, headers);
    }

    if (upstream.status !== 502 && upstream.status !== 504) {
      if (!upstream.ok) {
        if (upstream.status === 403) {
          logGateUnsound(runId, 'upstream_gate_forbidden');
        }
        if (upstream.status >= 500) {
          return classifyCadenceActionFailure(
            makeUpstreamStatusError(upstream.status, upstream.error ?? 'Upstream gate failed.'),
            'gate',
            correlationId,
            logger,
            headers,
          );
        }
        const msg =
          typeof upstream.data?.['error'] === 'string'
            ? upstream.data['error']
            : 'Upstream gate update failed.';
        return actionError(
          'gate',
          upstream.status,
          msg,
          mapHttpStatusToErrorCode(upstream.status),
          ctx,
        );
      }

      const parsed = CadenceRunResultSchema.safeParse(upstream.data?.['run']);
      if (!parsed.success) {
        return actionError(
          'gate',
          502,
          'Upstream gate payload failed contract validation.',
          'ERR_UPSTREAM_UNAVAILABLE',
          ctx,
          { action: 'Retry shortly.' },
        );
      }

      return data<PortalCadenceActionResult>(
        { ok: true, intent: 'gate', run: parsed.data },
        { status: 200, headers },
      );
    }
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
    return actionError('spec-approve', 400, 'Invalid runId for spec approval.', 'ERR_VALIDATION', ctx);
  }

  if (cadenceDemoUrl) {
    let upstream: Awaited<ReturnType<typeof proxyJson<Record<string, unknown>>>>;
    try {
      upstream = await proxyJson<Record<string, unknown>>({
        baseUrl: cadenceDemoUrl,
        path: `/v1/cadence/runs/${encodeURIComponent(runId)}/spec-gate`,
        method: 'POST',
        headers: { 'x-session-id': sessionId, 'X-Correlation-Id': correlationId },
        body: { approved: true },
        timeoutMs: 8_000,
        internalAuth: { role: 'guest', subject: sessionId },
      });
    } catch (error) {
      return classifyCadenceActionFailure(error, 'spec-approve', correlationId, logger, headers);
    }

    if (upstream.status !== 502 && upstream.status !== 504) {
      if (!upstream.ok) {
        if (upstream.status >= 500) {
          return classifyCadenceActionFailure(
            makeUpstreamStatusError(
              upstream.status,
              upstream.error ?? 'Upstream spec approval failed.',
            ),
            'spec-approve',
            correlationId,
            logger,
            headers,
          );
        }
        const msg =
          typeof upstream.data?.['error'] === 'string'
            ? upstream.data['error']
            : 'Upstream spec approval rejected.';
        return actionError(
          'spec-approve',
          upstream.status,
          msg,
          mapHttpStatusToErrorCode(upstream.status),
          ctx,
        );
      }

      const parsedRun = CadenceRunResultSchema.safeParse(upstream.data?.['run']);
      const parsedQuota = QuotaStatusSchema.safeParse(upstream.data?.['quota']);
      if (!parsedRun.success) {
        return actionError(
          'spec-approve',
          502,
          'Upstream spec approval payload failed contract validation.',
          'ERR_UPSTREAM_UNAVAILABLE',
          ctx,
          { action: 'Retry shortly.' },
        );
      }

      return data<PortalCadenceActionResult>(
        {
          ok: true,
          intent: 'spec-approve',
          run: parsedRun.data,
          ...(parsedQuota.success ? { quota: parsedQuota.data } : {}),
        },
        { status: 202, headers },
      );
    }
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
    let upstream: Awaited<ReturnType<typeof proxyJson<Record<string, unknown>>>>;
    try {
      upstream = await proxyJson<Record<string, unknown>>({
        baseUrl: cadenceDemoUrl,
        path: '/v1/cadence/runs',
        method: 'POST',
        headers: { 'x-session-id': sessionId, 'X-Correlation-Id': correlationId },
        body: validatedReq.data,
        timeoutMs: resolveInitTimeoutMs(resolvedMode),
        internalAuth: { role: 'guest', subject: sessionId },
      });
    } catch (error) {
      return classifyCadenceActionFailure(error, 'run', correlationId, logger, headers);
    }

    if (upstream.status !== 502 && upstream.status !== 504) {
      if (upstream.status === 429) {
        const parsedQuota = QuotaStatusSchema.safeParse(upstream.data?.['quota']);
        return data<PortalCadenceActionResult>(
          {
            ok: false,
            intent: 'run',
            error:
              typeof upstream.data?.['error'] === 'string'
                ? upstream.data['error']
                : 'Session or daily CADENCE quota exceeded.',
            code: 'ERR_RATE_LIMITED',
            action: 'Wait a moment and submit again.',
            correlationId,
            ...(parsedQuota.success ? { quota: parsedQuota.data } : {}),
          },
          { status: 429, headers },
        );
      }

      if (!upstream.ok) {
        if (upstream.status >= 500) {
          return classifyCadenceActionFailure(
            makeUpstreamStatusError(upstream.status, upstream.error ?? 'Upstream run failed.'),
            'run',
            correlationId,
            logger,
            headers,
          );
        }
        const msg =
          typeof upstream.data?.['error'] === 'string'
            ? upstream.data['error']
            : 'Upstream CADENCE run request rejected.';
        return data<PortalCadenceActionResult>(
          {
            ok: false,
            intent: 'run',
            error: msg,
            code: mapHttpStatusToErrorCode(upstream.status),
            correlationId,
          },
          { status: upstream.status, headers },
        );
      }

      const parsedRun = CadenceRunResultSchema.safeParse(upstream.data);
      const parsedQuota = QuotaStatusSchema.safeParse(upstream.data?.['quota']);
      if (!parsedRun.success) {
        return data<PortalCadenceActionResult>(
          {
            ok: false,
            intent: 'run',
            error: 'Upstream run payload failed contract validation.',
            code: 'ERR_UPSTREAM_UNAVAILABLE',
            action: 'Retry shortly.',
            correlationId,
          },
          { status: 502, headers },
        );
      }

      // Honor legacy synchronous 201 upstream responses without requiring an extra stream hop.
      if (!parsedRun.data.runStatus || parsedRun.data.runStatus === 'ready') {
        return data<PortalCadenceActionResult>(
          {
            ok: true,
            intent: 'run',
            run: parsedRun.data,
            ...(parsedQuota.success ? { quota: parsedQuota.data } : {}),
          },
          { status: 201, headers },
        );
      }

      return data<PortalCadenceActionResult>(
        {
          ok: true,
          intent: 'run-init',
          run: parsedRun.data,
          ...(parsedQuota.success ? { quota: parsedQuota.data } : {}),
        },
        { status: 202, headers },
      );
    }
  }

  // Fallback ONLY when CADENCE_DEMO_URL is unset or returned 502/504.
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
