import { type CadenceStreamErrorEvent, createPublicAppError } from '@aklapper/core';
import { classifyServerError } from '@aklapper/core/server-errors';
import {
  claimPendingSandboxRun,
  getQuotaStatusForSession,
  getSandboxRunWithTurnsById,
  getSharedDb,
} from '@aklapper/db';
import { GUEST_SESSION_COOKIE_NAME, parseCookieHeader } from '@aklapper/node-runtime/auth';
import { proxySse } from '@aklapper/node-runtime/http';
import {
  createFallbackLogger,
  getOrCreateCorrelationId,
  getRequestContext,
  logDiagnosticError,
} from '@aklapper/node-runtime/ssr/stream';

import {
  createSafeSseSink,
  logCadenceStreamSeam,
  pollActiveFallbackRunSse,
  replayReadyRunSse,
  runFallbackChordPipelineSse,
} from '../cadence-fallback-stream.server';
import type { Route } from './+types/api.cadence.runs.$runId.stream';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SESSION_ID_RE = /^[a-zA-Z0-9_-]{8,96}$/;
const SSE_BASE_HEADERS: Readonly<Record<string, string>> = {
  'content-type': 'text/event-stream; charset=utf-8',
  'cache-control': 'no-cache',
  connection: 'keep-alive',
  'x-accel-buffering': 'no',
};

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

  // Strictly read cookie header without issuing a new session or reading URL query params.
  const cookies = parseCookieHeader(request.headers.get('cookie'));
  const sessionId = cookies[GUEST_SESSION_COOKIE_NAME]?.trim();
  if (!sessionId || !SESSION_ID_RE.test(sessionId)) {
    logCadenceStreamSeam(
      'error',
      'UNSOUND_CONDITION',
      'cadence.stream.session_mismatch_or_missing',
      'critical',
      { runId, reason: 'missing_cookie', correlationId },
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
  if (cadenceDemoUrl) {
    const upstream = await proxySse({
      baseUrl: cadenceDemoUrl,
      path: `/v1/cadence/runs/${encodeURIComponent(runId)}/stream`,
      headers: {
        'x-session-id': sessionId,
        'X-Correlation-Id': correlationId,
      },
      internalAuth: { role: 'guest', subject: sessionId },
      signal: request.signal,
    });
    if (upstream.status !== 502 && upstream.status !== 504) {
      return upstream;
    }
  }

  let db: ReturnType<typeof getSharedDb>;
  let record: Awaited<ReturnType<typeof getSandboxRunWithTurnsById>>;
  try {
    db = getSharedDb();
    record = await getSandboxRunWithTurnsById(db, runId);
  } catch (error) {
    const { publicError, diagnostic } = classifyServerError(error, {
      correlationId,
      source: 'portal.cadence.stream',
    });
    logDiagnosticError(logger, diagnostic);
    return Response.json(
      { error: publicError.message, ...publicError },
      { status: publicError.status, headers: jsonHeaders },
    );
  }

  if (!record) {
    return Response.json(
      {
        error: 'Sandbox run not found.',
        ...createPublicAppError({
          code: 'ERR_NOT_FOUND',
          status: 404,
          message: 'Sandbox run not found.',
          action: 'Start a new build from /cadence.',
          correlationId,
        }),
      },
      { status: 404, headers: jsonHeaders },
    );
  }
  if (record.sessionId !== sessionId) {
    logCadenceStreamSeam(
      'error',
      'UNSOUND_CONDITION',
      'cadence.stream.session_mismatch_or_missing',
      'critical',
      { runId, reason: 'session_mismatch', correlationId },
    );
    return Response.json(
      {
        error: 'Sandbox run belongs to a different session.',
        ...createPublicAppError({
          code: 'ERR_FORBIDDEN',
          status: 403,
          message: 'Sandbox run belongs to a different session.',
          action: 'Run your own build in this session.',
          correlationId,
        }),
      },
      { status: 403, headers: jsonHeaders },
    );
  }

  const encoder = new TextEncoder();
  let streamCancelled = false;
  const isCancelled = (): boolean => streamCancelled || request.signal.aborted;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const sink = createSafeSseSink(controller, encoder, isCancelled);
      try {
        if (record.run.runStatus === 'ready') {
          logCadenceStreamSeam('info', 'RULE_DIVERGENCE', 'cadence.run.execution_branch', 'info', {
            runId,
            branch: 'stream-replay',
          });
          const quota = await getQuotaStatusForSession(db, 'guest', sessionId);
          replayReadyRunSse(sink, record.run, quota);
          return;
        }

        if (record.run.runStatus === 'failed') {
          sink.enqueue('error', {
            runId,
            error: 'Sandbox run failed before artifact completion.',
            runStatus: 'failed',
          } satisfies CadenceStreamErrorEvent);
          return;
        }

        const claimed = await claimPendingSandboxRun(db, runId, sessionId);
        if (!claimed) {
          if (record.run.runStatus === 'pending') {
            logCadenceStreamSeam(
              'warn',
              'UNSOUND_CONDITION',
              'cadence.run.invalid_claim_state',
              'warn',
              { runId, status: record.run.runStatus },
            );
          }
          await pollActiveFallbackRunSse(db, runId, sessionId, isCancelled, sink);
          return;
        }

        logCadenceStreamSeam('info', 'RULE_DIVERGENCE', 'cadence.run.execution_branch', 'info', {
          runId,
          branch: `${claimed.mode}-node-fallback`,
        });
        await runFallbackChordPipelineSse(db, claimed.run, claimed.mode, sessionId, sink);
      } finally {
        sink.close();
      }
    },
    cancel() {
      streamCancelled = true;
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      ...SSE_BASE_HEADERS,
      'X-Correlation-Id': correlationId,
    },
  });
}
