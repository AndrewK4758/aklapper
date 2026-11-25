import { AskTurnStateSchema, createPublicAppError, isPublicAppError } from '@aklapper/core';
import { classifyServerError } from '@aklapper/core/server-errors';
import { proxyJson } from '@aklapper/node-runtime/http';
import {
  createFallbackLogger,
  getOrCreateCorrelationId,
  getRequestContext,
  logDiagnosticError,
} from '@aklapper/node-runtime/ssr/stream';

import { requireGuestSession } from '../guest-session.server';
import type { Route } from './+types/api.ask.turns.$attemptId';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function loader({ request, params, context }: Route.LoaderArgs): Promise<Response> {
  const reqCtx = getRequestContext(context);
  const correlationId = getOrCreateCorrelationId(request, context);
  const logger = reqCtx?.logger ?? createFallbackLogger('portal-ask-turn-poll');
  const headers: Record<string, string> = {
    'X-Correlation-Id': correlationId,
  };

  let sessionId: string | null;
  try {
    sessionId = requireGuestSession(request);
  } catch (error) {
    const { publicError, diagnostic } = classifyServerError(error, {
      correlationId,
      source: 'portal.ask.turn_poll.session',
    });
    logDiagnosticError(logger, diagnostic);
    return Response.json(publicError, { status: publicError.status, headers });
  }

  if (!sessionId) {
    return Response.json(
      createPublicAppError({
        code: 'ERR_UNAUTHORIZED',
        status: 401,
        message: 'Valid guest session cookie is required.',
        action: 'Open /chat to establish a session and retry.',
        correlationId,
      }),
      { status: 401, headers },
    );
  }

  const attemptId = (params.attemptId ?? '').trim();
  if (!UUID_RE.test(attemptId)) {
    return Response.json(
      createPublicAppError({
        code: 'ERR_VALIDATION',
        status: 400,
        message: 'Invalid ask attempt identifier.',
        action: 'Refresh and submit a new question.',
        correlationId,
      }),
      { status: 400, headers },
    );
  }

  const aiAskUrl = process.env['AI_ASK_URL']?.trim();
  if (!aiAskUrl) {
    return Response.json(
      createPublicAppError({
        code: 'ERR_UPSTREAM_UNAVAILABLE',
        status: 503,
        message: 'Upstream service unreachable.',
        action: 'Retry shortly or go home.',
        correlationId,
      }),
      { status: 503, headers },
    );
  }

  const upstream = await proxyJson<Record<string, unknown>>({
    baseUrl: aiAskUrl,
    path: `/v1/ask/turns/${encodeURIComponent(attemptId)}`,
    method: 'GET',
    headers: { 'X-Correlation-Id': correlationId },
    internalAuth: { role: 'guest', subject: sessionId },
    timeoutMs: 10_000,
    signal: request.signal,
  });

  if (upstream.status === 404) {
    return Response.json(
      createPublicAppError({
        code: 'ERR_NOT_FOUND',
        status: 404,
        message: 'Ask turn not found or expired.',
        action: 'Submit a fresh question.',
        correlationId,
      }),
      { status: 404, headers },
    );
  }

  if (upstream.data) {
    const parsedState = AskTurnStateSchema.safeParse(upstream.data);
    if (parsedState.success) {
      return Response.json(parsedState.data, { status: upstream.status, headers });
    }
  }

  const upstreamErr = Object.assign(new Error(upstream.error ?? 'Upstream turn poll failed'), {
    status: upstream.status >= 400 ? upstream.status : 502,
    statusText: 'Upstream Error',
    data: isPublicAppError(upstream.data) ? upstream.data : null,
  });
  const { publicError, diagnostic } = classifyServerError(upstreamErr, {
    correlationId,
    source: 'portal.ask.turn_poll',
  });
  logDiagnosticError(logger, diagnostic);

  const responseStatus =
    upstream.error === 'UPSTREAM_UNAVAILABLE'
      ? 503
      : upstream.status === 504 || upstream.status === 502 || upstream.status === 503
        ? upstream.status
        : publicError.status;

  return Response.json(
    createPublicAppError({
      ...publicError,
      status: responseStatus,
    }),
    { status: responseStatus, headers },
  );
}
