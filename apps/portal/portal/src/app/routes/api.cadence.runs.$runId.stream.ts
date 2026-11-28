import { type CadenceStreamErrorEvent, createPublicAppError } from '@aklapper/core';
import { classifyServerError } from '@aklapper/core/server-errors';
import {
  bridgeGrpcStreamToSse,
  mapProtoCadenceChunkToSse,
  streamCadenceRun,
} from '@aklapper/node-runtime/grpc';
import {
  createFallbackLogger,
  getOrCreateCorrelationId,
  getRequestContext,
  logDiagnosticError,
} from '@aklapper/node-runtime/ssr/stream';

import { requireGuestSession } from '../guest-session.server';
import type { Route } from './+types/api.cadence.runs.$runId.stream';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function loader({ request, params, context }: Route.LoaderArgs): Promise<Response> {
  const reqCtx = getRequestContext(context);
  const correlationId = getOrCreateCorrelationId(request, context);
  const logger = reqCtx?.logger ?? createFallbackLogger('portal-cadence-stream');
  const jsonHeaders: Record<string, string> = { 'X-Correlation-Id': correlationId };

  const runId = params.runId?.trim() ?? '';
  if (!UUID_RE.test(runId)) {
    return Response.json(
      {
        error: 'Invalid sandbox run ID.',
        ...createPublicAppError({
          code: 'ERR_VALIDATION',
          status: 400,
          message: 'Invalid sandbox run ID.',
          action: 'Start a fresh build from the CADENCE builder.',
          correlationId,
        }),
      },
      { status: 400, headers: jsonHeaders },
    );
  }

  let sessionId: string | null;
  try {
    sessionId = requireGuestSession(request);
  } catch (error) {
    const { publicError, diagnostic } = classifyServerError(error, {
      correlationId,
      source: 'portal.cadence.stream.session',
    });
    logDiagnosticError(logger, diagnostic);
    return Response.json(publicError, { status: publicError.status, headers: jsonHeaders });
  }
  if (!sessionId) {
    logger.error(
      {
        seam_type: 'UNSOUND_CONDITION',
        event: 'cadence.stream.session_mismatch_or_missing',
        runId,
        reason: 'missing_cookie',
        correlationId,
      },
      'Blocked CADENCE SSE stream without signed guest session cookie',
    );
    return Response.json(
      {
        error: 'Missing guest session cookie.',
        ...createPublicAppError({
          code: 'ERR_UNAUTHORIZED',
          status: 401,
          message: 'Missing guest session cookie.',
          action: 'Open /cadence first to establish a session.',
          correlationId,
        }),
      },
      { status: 401, headers: jsonHeaders },
    );
  }

  const cadenceDemoUrl = process.env['CADENCE_DEMO_URL']?.trim();
  if (!cadenceDemoUrl) {
    const publicError = createPublicAppError({
      code: 'ERR_UPSTREAM_UNAVAILABLE',
      status: 503,
      message: 'Upstream service unreachable.',
      action: 'Retry shortly or go home.',
      correlationId,
    });
    return Response.json(
      { error: publicError.message, ...publicError },
      {
        status: 503,
        headers: jsonHeaders,
      },
    );
  }

  return bridgeGrpcStreamToSse({
    headerTimeoutMs: 15_000,
    signal: request.signal,
    correlationId,
    source: 'portal.cadence.stream',
    logger,
    startStream: ({ signal, onHeader }) =>
      streamCadenceRun(
        {
          baseUrl: cadenceDemoUrl,
          internalAuth: { role: 'guest', subject: sessionId },
          correlationId,
          signal,
          logger,
        },
        runId,
        { onHeader },
      ),
    mapChunkToSse: chunk => mapProtoCadenceChunkToSse(chunk, logger),
    buildPostHeaderErrorFrame: failure => ({
      event: 'error',
      data: {
        runId,
        error: failure.publicError.message,
        code: failure.publicError.code,
        runStatus: 'failed',
      } satisfies CadenceStreamErrorEvent,
    }),
    onPreStreamFailure: failure => {
      const status =
        failure.publicError.code === 'ERR_UPSTREAM_UNAVAILABLE' ? 503 : failure.publicError.status;
      return Response.json(
        { error: failure.publicError.message, ...failure.publicError, status },
        { status, headers: jsonHeaders },
      );
    },
  });
}
