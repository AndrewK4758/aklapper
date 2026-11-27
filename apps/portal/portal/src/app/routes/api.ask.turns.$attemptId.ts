import { createPublicAppError } from '@aklapper/core';
import { classifyServerError } from '@aklapper/core/server-errors';
import { classifyGrpcError, getAskTurn } from '@aklapper/node-runtime/grpc';
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

  try {
    const turn = await getAskTurn(
      {
        baseUrl: aiAskUrl,
        internalAuth: { role: 'guest', subject: sessionId },
        correlationId,
        timeoutMs: 10_000,
        signal: request.signal,
        logger,
      },
      attemptId,
    );
    let responseStatus = 202;
    if (turn.status === 'completed' || turn.status === 'abstained') {
      responseStatus = 200;
    } else if (turn.status === 'expired') {
      responseStatus = 504;
    } else if (turn.status === 'failed') {
      responseStatus = turn.error && turn.error.status >= 400 ? turn.error.status : 502;
    }
    return Response.json(turn, { status: responseStatus, headers });
  } catch (error) {
    const failure = classifyGrpcError(error, {
      correlationId,
      source: 'portal.ask.turn_poll',
      normalizeUnavailableStatus: 503,
      logger,
    });
    if (failure.publicError.status === 404) {
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
    return Response.json(failure.publicError, { status: failure.publicError.status, headers });
  }
}
