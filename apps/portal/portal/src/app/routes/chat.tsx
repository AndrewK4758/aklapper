import { randomUUID } from 'node:crypto';

import {
  type AskMode,
  type AskServiceStatus,
  AskServiceStatusSchema,
  createPublicAppError,
} from '@aklapper/core';
import { classifyServerError } from '@aklapper/core/server-errors';
import { callAsk, classifyGrpcError, getAskStatus } from '@aklapper/node-runtime/grpc';
import {
  createFallbackLogger,
  deferStreamResult,
  getOrCreateCorrelationId,
  getRequestContext,
  logDiagnosticError,
} from '@aklapper/node-runtime/ssr/stream';
import { RouteErrorBoundaryView } from '@aklapper/ui';
import { data, href } from 'react-router';

import type { PortalAskActionResult } from '#pages/ask';

import { reportPortalPublicError } from '../client-telemetry';
import { triggerPortalGuestSessionBinding } from '../contact-analytics-link.server';
import { ChatRouteView } from '../features/ChatFeatureView';
import { createPrimaryRouteClientAction } from '../features/paneClientAction';
import { resolveGuestSession } from '../guest-session.server';
import { loadPortalAskDataWithPrerender } from '../portal-api.server';
import { buildPortalPageMeta } from '../seo';
import type { Route } from './+types/chat';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function probeAskServiceStatus(
  aiAskUrl: string | undefined,
  signal: AbortSignal | undefined,
  correlationId: string,
): Promise<AskServiceStatus | undefined> {
  if (!aiAskUrl) return undefined;
  try {
    const res = await getAskStatus({
      baseUrl: aiAskUrl,
      internalAuth: { role: 'service', subject: 'portal-ask-status' },
      correlationId,
      timeoutMs: 1_500,
      ...(signal ? { signal } : {}),
    });
    const candidate = AskServiceStatusSchema.safeParse({
      status: res.status === 'ready' ? 'ready' : 'degraded',
      provider: res.provider || 'ai-ask',
      pointsCount: res.collection?.pointsCount ?? 0,
    });
    return candidate.success
      ? candidate.data
      : { status: 'degraded', provider: 'ai-ask', pointsCount: 0 };
  } catch {
    return { status: 'offline', provider: 'ai-ask', pointsCount: 0 };
  }
}

export function loader({ request, context }: Route.LoaderArgs) {
  const { sessionId, setCookieHeader } = resolveGuestSession(request);
  const correlationId = getOrCreateCorrelationId(request, context);
  const aiAskUrl = process.env['AI_ASK_URL']?.trim();
  const reqCtx = getRequestContext(context);
  triggerPortalGuestSessionBinding(request, sessionId, reqCtx?.logger, '/chat');

  return data(
    {
      correlationId,
      payload: deferStreamResult(
        loadPortalAskDataWithPrerender(sessionId, {
          correlationId,
          ...(reqCtx?.logger ? { logger: reqCtx.logger } : {}),
          signal: reqCtx?.signal ?? request.signal,
        }),
        {
          request,
          context,
          source: 'portal.chat.loader',
        },
      ),
      askStatusPayload: deferStreamResult(
        probeAskServiceStatus(aiAskUrl, reqCtx?.signal ?? request.signal, correlationId),
        {
          request,
          context,
          source: 'portal.chat.status',
        },
      ),
    },
    setCookieHeader ? { headers: { 'Set-Cookie': setCookieHeader } } : undefined,
  );
}

export async function action({ request, context }: Route.ActionArgs) {
  const { sessionId, setCookieHeader } = resolveGuestSession(request);
  const reqCtx = getRequestContext(context);
  const correlationId = getOrCreateCorrelationId(request, context);
  const logger = reqCtx?.logger ?? createFallbackLogger('portal-chat');
  triggerPortalGuestSessionBinding(request, sessionId, logger, '/chat');
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
        error: 'Malformed chat submission payload.',
        code: 'ERR_VALIDATION',
        action: 'Review your message and retry.',
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
      { correlationId, source: 'portal.chat.action' },
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

  try {
    const result = await callAsk(
      {
        baseUrl: aiAskUrl,
        internalAuth: { role: 'guest', subject: sessionId },
        correlationId,
        timeoutMs: 35_000,
        signal: request.signal,
        logger,
      },
      mode === 'qa'
        ? { mode, question: text, attemptId }
        : { mode, jobDescription: text, attemptId },
    );

    if (result.kind === 'pending') {
      return data<PortalAskActionResult>(
        {
          ok: true,
          pending: true,
          mode,
          submittedText: text,
          attemptId: result.turn.attemptId,
          turnState: result.turn,
        },
        { status: 202, headers },
      );
    }

    return data<PortalAskActionResult>(
      {
        ok: true,
        mode,
        submittedText: text,
        attemptId: result.response.attemptId ?? attemptId,
        response: result.response,
      },
      { status: 200, headers },
    );
  } catch (error) {
    const failure = classifyGrpcError(error, {
      correlationId,
      source: 'portal.chat.action',
      normalizeUnavailableStatus: 503,
      logger,
    });
    return data<PortalAskActionResult>(
      {
        ok: false,
        mode,
        error: failure.publicError.message,
        code: failure.publicError.code,
        action: failure.publicError.action,
        correlationId: failure.publicError.correlationId,
        ...(failure.quota ? { quota: failure.quota } : {}),
      },
      { status: failure.publicError.status, headers },
    );
  }
}

export const clientAction = createPrimaryRouteClientAction<PortalAskActionResult>('/chat');

export function meta({ matches, location }: Route.MetaArgs) {
  return buildPortalPageMeta({
    matches,
    pathname: location.pathname,
    title: 'Chat with Andrew // andrew-k.us',
    description:
      "Chat with Andrew's AI about Andrew Klapper's portfolio, general engineering topics, or evaluate role fit against published career dossiers.",
  });
}

export default function PortalChatRoute({ loaderData }: Route.ComponentProps) {
  return <ChatRouteView loaderData={loaderData} />;
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
