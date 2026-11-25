import { randomUUID } from 'node:crypto';

import {
  type AskMode,
  AskResponseSchema,
  type AskServiceStatus,
  AskServiceStatusSchema,
  AskTurnStateSchema,
  type PortalAskLoaderData,
  QuotaStatusSchema,
  createPublicAppError,
  isPublicAppError,
} from '@aklapper/core';
import { classifyServerError } from '@aklapper/core/server-errors';
import { loadPortalAskDataWithPrerender } from '@aklapper/db';
import { proxyJson } from '@aklapper/node-runtime/http';
import {
  createFallbackLogger,
  deferStreamResult,
  getOrCreateCorrelationId,
  getRequestContext,
  logDiagnosticError,
} from '@aklapper/node-runtime/ssr/stream';
import { RouteErrorBoundaryView, SuspenseElement, usePaneNavigation } from '@aklapper/ui';
import { data, href, useFetcher, useNavigate } from 'react-router';

import { type PortalAskActionResult, PortalAskPage } from '#pages/ask';

import { reportPortalPublicError } from '../client-telemetry';
import { resolveGuestSession } from '../guest-session.server';
import { buildPortalPageMeta } from '../seo';
import type { Route } from './+types/ask';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function probeAskServiceStatus(
  aiAskUrl: string | undefined,
  signal: AbortSignal | undefined,
): Promise<AskServiceStatus | undefined> {
  if (!aiAskUrl) return undefined;
  const res = await proxyJson<Record<string, unknown>>({
    baseUrl: aiAskUrl,
    path: '/v1/ask/status',
    method: 'GET',
    timeoutMs: 1_500,
    signal,
  });
  if (!res.ok || !res.data) {
    return { status: 'offline', provider: 'ai-ask', pointsCount: 0 };
  }
  const collection =
    res.data['collection'] && typeof res.data['collection'] === 'object'
      ? (res.data['collection'] as Record<string, unknown>)
      : null;
  const candidate = AskServiceStatusSchema.safeParse({
    status: res.data['status'] === 'ready' ? 'ready' : 'degraded',
    provider: typeof res.data['provider'] === 'string' ? res.data['provider'] : 'ai-ask',
    pointsCount: typeof collection?.['pointsCount'] === 'number' ? collection['pointsCount'] : 0,
  });
  return candidate.success
    ? candidate.data
    : { status: 'degraded', provider: 'ai-ask', pointsCount: 0 };
}

export function loader({ request, context }: Route.LoaderArgs) {
  const { sessionId, setCookieHeader } = resolveGuestSession(request);
  const correlationId = getOrCreateCorrelationId(request, context);
  const aiAskUrl = process.env['AI_ASK_URL']?.trim();
  const reqCtx = getRequestContext(context);

  const loadCombined = async (): Promise<PortalAskLoaderData> => {
    const [base, askStatus] = await Promise.all([
      loadPortalAskDataWithPrerender(sessionId),
      probeAskServiceStatus(aiAskUrl, reqCtx?.signal ?? request.signal),
    ]);
    return askStatus ? { ...base, askStatus } : base;
  };

  return data(
    {
      correlationId,
      payload: deferStreamResult(loadCombined(), {
        request,
        context,
        source: 'portal.ask.loader',
      }),
    },
    setCookieHeader ? { headers: { 'Set-Cookie': setCookieHeader } } : undefined,
  );
}

export async function action({ request, context }: Route.ActionArgs) {
  const { sessionId, setCookieHeader } = resolveGuestSession(request);
  const reqCtx = getRequestContext(context);
  const correlationId = getOrCreateCorrelationId(request, context);
  const logger = reqCtx?.logger ?? createFallbackLogger('portal-ask');
  const headers: Record<string, string> = {
    'X-Correlation-Id': correlationId,
    ...(setCookieHeader ? { 'Set-Cookie': setCookieHeader } : {}),
  };

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return data<PortalAskActionResult>(
      {
        ok: false,
        mode: 'qa',
        error: 'Malformed ask submission payload.',
        code: 'ERR_VALIDATION',
        action: 'Review your question and retry.',
        correlationId,
      },
      { status: 400, headers },
    );
  }

  const rawMode = String(formData.get('mode') ?? 'qa').trim();
  const mode: AskMode = rawMode === 'jd_match' ? 'jd_match' : 'qa';
  const text = String(formData.get('text') ?? '').trim();
  const rawAttemptId = String(formData.get('attemptId') ?? '').trim();
  const attemptId = rawAttemptId || randomUUID();

  if (!UUID_RE.test(attemptId)) {
    return data<PortalAskActionResult>(
      {
        ok: false,
        mode,
        error: 'Invalid submission attempt identifier.',
        code: 'ERR_VALIDATION',
        action: 'Refresh and retry your request.',
        correlationId,
      },
      { status: 400, headers },
    );
  }

  if (mode === 'qa' && (text.length < 4 || text.length > 800)) {
    return data<PortalAskActionResult>(
      {
        ok: false,
        mode,
        error: 'Question must be between 4 and 800 characters.',
        code: 'ERR_VALIDATION',
        correlationId,
      },
      { status: 400, headers },
    );
  }
  if (mode === 'jd_match' && (text.length < 20 || text.length > 8000)) {
    return data<PortalAskActionResult>(
      {
        ok: false,
        mode,
        error: 'Job description must be between 20 and 8000 characters.',
        code: 'ERR_VALIDATION',
        correlationId,
      },
      { status: 400, headers },
    );
  }

  const aiAskUrl = process.env['AI_ASK_URL']?.trim();
  if (!aiAskUrl) {
    const { publicError, diagnostic } = classifyServerError(
      Object.assign(new Error('AI_ASK_URL is not configured'), {
        status: 503,
        statusText: 'Service Unavailable',
        data: createPublicAppError({
          code: 'ERR_UPSTREAM_UNAVAILABLE',
          status: 503,
          message: 'Upstream service unreachable.',
          action: 'Retry shortly or go home.',
          correlationId,
        }),
      }),
      { correlationId, source: 'portal.ask.action' },
    );
    logDiagnosticError(logger, diagnostic);
    return data<PortalAskActionResult>(
      {
        ok: false,
        mode,
        error: publicError.message,
        code: publicError.code,
        action: publicError.action,
        correlationId: publicError.correlationId,
      },
      { status: 503, headers },
    );
  }

  const upstream = await proxyJson<Record<string, unknown>>({
    baseUrl: aiAskUrl,
    path: '/v1/ask',
    method: 'POST',
    headers: { 'X-Correlation-Id': correlationId },
    internalAuth: { role: 'guest', subject: sessionId },
    body:
      mode === 'qa'
        ? { mode, question: text, attemptId }
        : { mode, jobDescription: text, attemptId },
    timeoutMs: 35_000,
    signal: request.signal,
  });

  if (upstream.status === 429) {
    const parsedQuota = QuotaStatusSchema.safeParse(upstream.data?.['quota']);
    return data<PortalAskActionResult>(
      {
        ok: false,
        mode,
        error:
          typeof upstream.data?.['error'] === 'string'
            ? upstream.data['error']
            : 'Session or daily quota exceeded.',
        code: 'ERR_RATE_LIMITED',
        action: 'Wait a moment and submit again.',
        correlationId,
        ...(parsedQuota.success ? { quota: parsedQuota.data } : {}),
      },
      { status: 429, headers },
    );
  }

  if (upstream.status === 202 && upstream.data) {
    const parsedState = AskTurnStateSchema.safeParse(upstream.data);
    if (parsedState.success) {
      return data<PortalAskActionResult>(
        {
          ok: true,
          pending: true,
          mode,
          submittedText: text,
          attemptId: parsedState.data.attemptId,
          turnState: parsedState.data,
        },
        { status: 202, headers },
      );
    }
  }

  if (upstream.ok && upstream.data) {
    const parsed = AskResponseSchema.safeParse(upstream.data);
    if (parsed.success) {
      return data<PortalAskActionResult>(
        {
          ok: true,
          mode,
          submittedText: text,
          attemptId: parsed.data.attemptId ?? attemptId,
          response: parsed.data,
        },
        { status: 200, headers },
      );
    }
  }

  const rawStatus =
    upstream.error === 'UPSTREAM_TIMEOUT'
      ? 504
      : upstream.error === 'UPSTREAM_UNAVAILABLE'
        ? 503
        : upstream.status >= 400
          ? upstream.status
          : 503;

  const { publicError, diagnostic } = classifyServerError(
    Object.assign(new Error(upstream.error ?? `AI ask upstream HTTP ${rawStatus}`), {
      status: rawStatus,
      statusText: 'Upstream Error',
      data: isPublicAppError(upstream.data) ? upstream.data : null,
    }),
    { correlationId, source: 'portal.ask.action' },
  );
  logDiagnosticError(logger, diagnostic);

  return data<PortalAskActionResult>(
    {
      ok: false,
      mode,
      error: publicError.message,
      code: publicError.code,
      action: publicError.action,
      correlationId: publicError.correlationId,
    },
    { status: rawStatus, headers },
  );
}

export function meta({ matches, location }: Route.MetaArgs) {
  return buildPortalPageMeta({
    matches,
    pathname: location.pathname,
    title: 'Ask Portfolio & JD Match // andrew-k.us',
    description: 'Grounded portfolio RAG Q&A and Job Description matcher with strict abstention.',
  });
}

export default function PortalAskRoute({ loaderData }: Route.ComponentProps) {
  const fetcher = useFetcher<PortalAskActionResult>();
  const navigate = useNavigate();
  const paneNav = usePaneNavigation();

  return (
    <SuspenseElement<PortalAskLoaderData>
      resolve={loaderData.payload}
      correlationId={loaderData.correlationId}
      homeHref={href('/')}
      loadingLabel='Loading portfolio Q&A...'
      onStreamError={error => {
        reportPortalPublicError(error, { phase: 'stream' });
      }}
    >
      {({ content, quota, askStatus }) => (
        <PortalAskPage
          content={content}
          quota={quota}
          askStatus={askStatus}
          actionResult={fetcher.data}
          isSubmitting={fetcher.state !== 'idle'}
          onSubmitAsk={({ mode, text, attemptId }) => {
            void fetcher.submit(
              { mode, text, attemptId },
              { method: 'post', action: href('/ask') },
            );
          }}
          onClose={() => {
            if (paneNav?.docked) {
              paneNav.exitTui();
            } else {
              void navigate(href('/'));
            }
          }}
        />
      )}
    </SuspenseElement>
  );
}

export function ErrorBoundary({ error, loaderData }: Route.ErrorBoundaryProps) {
  return (
    <RouteErrorBoundaryView
      error={error}
      correlationId={loaderData?.correlationId}
      homeHref={href('/')}
      onError={publicError => {
        reportPortalPublicError(publicError, { phase: 'boundary' });
      }}
    />
  );
}
