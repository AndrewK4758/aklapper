import {
  type AppErrorCode,
  CadenceRunRequestSchema,
  CadenceRunResultSchema,
  QuotaStatusSchema,
} from '@aklapper/core';
import { classifyServerError } from '@aklapper/core/server-errors';
import {
  createPendingSandboxRunWithQuota,
  getSharedDb,
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

function mapHttpStatusToErrorCode(status: number): AppErrorCode {
  switch (status) {
    case 400:
    case 422:
      return 'ERR_VALIDATION';
    case 401:
      return 'ERR_UNAUTHORIZED';
    case 403:
      return 'ERR_FORBIDDEN';
    case 404:
      return 'ERR_NOT_FOUND';
    case 409:
      return 'ERR_CONSTRAINT';
    case 429:
      return 'ERR_RATE_LIMITED';
    default:
      return status >= 500 ? 'ERR_UPSTREAM_UNAVAILABLE' : 'ERR_INTERNAL';
  }
}

function makeOidcUnavailableError(): Error & { status: number; statusText: string; data: null } {
  return Object.assign(new Error('GCP_OIDC_TOKEN_UNAVAILABLE'), {
    status: 503,
    statusText: 'Service Unavailable',
    data: null,
  });
}

export function classifyCadenceActionFailure(
  error: unknown,
  intent: 'run' | 'gate',
  correlationId: string,
  logger: SsrStructuredLogger,
  headers: Record<string, string>,
) {
  const { publicError, diagnostic } = classifyServerError(error, {
    correlationId,
    source: `portal.cadence.${intent}`,
  });
  logDiagnosticError(logger, diagnostic);
  return data<PortalCadenceActionResult>(
    {
      ok: false,
      intent,
      error: publicError.message,
      code: publicError.code,
      action: publicError.action,
      correlationId: publicError.correlationId,
    },
    { status: publicError.status, headers },
  );
}

export async function handleCadenceGateAction(formData: FormData, ctx: CadenceActionContext) {
  const { sessionId, correlationId, logger, headers, cadenceDemoUrl } = ctx;
  const runId = String(formData.get('runId') ?? '').trim();
  const rawVerdict = String(formData.get('verdict') ?? '').trim();

  if (!UUID_RE.test(runId) || (rawVerdict !== 'approved' && rawVerdict !== 'rejected')) {
    return data<PortalCadenceActionResult>(
      {
        ok: false,
        intent: 'gate',
        error: 'Invalid runId or gate verdict.',
        code: 'ERR_VALIDATION',
        correlationId,
      },
      { status: 400, headers },
    );
  }

  if (cadenceDemoUrl) {
    const upstream = await proxyJson<Record<string, unknown>>({
      baseUrl: cadenceDemoUrl,
      path: `/v1/cadence/runs/${encodeURIComponent(runId)}/gate`,
      method: 'POST',
      headers: { 'x-session-id': sessionId, 'X-Correlation-Id': correlationId },
      body: { verdict: rawVerdict },
      timeoutMs: 6_000,
      internalAuth: { role: 'guest', subject: sessionId },
    });

    if (upstream.status !== 502 && upstream.status !== 504) {
      if (!upstream.ok) {
        if (upstream.status === 403) {
          logGateUnsound(runId, 'upstream_gate_forbidden');
        }
        if (upstream.status === 503 && upstream.error === 'GCP_OIDC_TOKEN_UNAVAILABLE') {
          return classifyCadenceActionFailure(
            makeOidcUnavailableError(),
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
        return data<PortalCadenceActionResult>(
          {
            ok: false,
            intent: 'gate',
            error: msg,
            code: mapHttpStatusToErrorCode(upstream.status),
            correlationId,
          },
          { status: upstream.status, headers },
        );
      }

      const parsed = CadenceRunResultSchema.safeParse(upstream.data?.['run']);
      if (!parsed.success) {
        return data<PortalCadenceActionResult>(
          {
            ok: false,
            intent: 'gate',
            error: 'Upstream gate payload failed contract validation.',
            code: 'ERR_UPSTREAM_UNAVAILABLE',
            action: 'Retry shortly.',
            correlationId,
          },
          { status: 502, headers },
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
      return data<PortalCadenceActionResult>(
        {
          ok: false,
          intent: 'gate',
          error: 'Sandbox run not found.',
          code: 'ERR_NOT_FOUND',
          correlationId,
        },
        { status: 404, headers },
      );
    }
    if (result.outcome === 'forbidden') {
      logGateUnsound(runId, 'gate_session_mismatch');
      return data<PortalCadenceActionResult>(
        {
          ok: false,
          intent: 'gate',
          error: 'Sandbox run belongs to a different session.',
          code: 'ERR_FORBIDDEN',
          correlationId,
        },
        { status: 403, headers },
      );
    }
    if (result.outcome === 'conflict') {
      return data<PortalCadenceActionResult>(
        {
          ok: false,
          intent: 'gate',
          error: `Run is currently "${result.status}" and cannot accept a gate verdict yet.`,
          code: 'ERR_CONSTRAINT',
          correlationId,
        },
        { status: 409, headers },
      );
    }

    return data<PortalCadenceActionResult>(
      { ok: true, intent: 'gate', run: result.run },
      { status: 200, headers },
    );
  } catch (error) {
    return classifyCadenceActionFailure(error, 'gate', correlationId, logger, headers);
  }
}

export async function handleCadenceRunAction(formData: FormData, ctx: CadenceActionContext) {
  const { sessionId, correlationId, logger, headers, cadenceDemoUrl } = ctx;
  const prompt = String(formData.get('prompt') ?? '').trim();
  const rawPreset = String(formData.get('presetSlug') ?? '').trim();
  const presetSlug = rawPreset && rawPreset !== '__custom__' ? rawPreset : 'custom';
  const rawMode = String(formData.get('mode') ?? 'fast').trim();

  const validatedReq = CadenceRunRequestSchema.safeParse({
    prompt,
    presetSlug,
    sessionId,
    mode: rawMode,
    deferExecution: true,
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
    const upstream = await proxyJson<Record<string, unknown>>({
      baseUrl: cadenceDemoUrl,
      path: '/v1/cadence/runs',
      method: 'POST',
      headers: { 'x-session-id': sessionId, 'X-Correlation-Id': correlationId },
      body: validatedReq.data,
      timeoutMs: resolveInitTimeoutMs(resolvedMode),
      internalAuth: { role: 'guest', subject: sessionId },
    });

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
        if (upstream.status === 503 && upstream.error === 'GCP_OIDC_TOKEN_UNAVAILABLE') {
          return classifyCadenceActionFailure(
            makeOidcUnavailableError(),
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
    const initResult = await createPendingSandboxRunWithQuota(db, {
      role: 'guest',
      sessionId,
      ipHash: 'portal-ssr',
      presetSlug,
      prompt: validatedReq.data.prompt,
      mode: resolvedMode,
      estimatedTokens: 800,
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
