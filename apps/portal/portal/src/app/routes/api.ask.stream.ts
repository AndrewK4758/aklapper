import { randomUUID } from 'node:crypto';

import { createPublicAppError } from '@aklapper/core';
import { DEFAULT_SSE_HEADER_TIMEOUT_MS, proxyPostSse } from '@aklapper/node-runtime/http';
import {
  createFallbackLogger,
  getOrCreateCorrelationId,
  getRequestContext,
} from '@aklapper/node-runtime/ssr/stream';

import { triggerPortalGuestSessionBinding } from '../contact-analytics-link.server';
import { resolveGuestSession } from '../guest-session.server';
import type { Route } from './+types/api.ask.stream';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VISITOR_LENS_RE = /^[a-z0-9-]{1,48}$/;
const DEV_SSE_HEADER_TIMEOUT_MS = 60_000;

export function resolveAskStreamHeaderTimeoutMs(
  env: Readonly<Record<string, string | undefined>> = process.env,
): number {
  const raw = env['ASK_SSE_HEADER_TIMEOUT_MS']?.trim();
  if (raw) {
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return env['NODE_ENV'] === 'production'
    ? DEFAULT_SSE_HEADER_TIMEOUT_MS
    : DEV_SSE_HEADER_TIMEOUT_MS;
}

function jsonErrorResponse(
  status: number,
  code: 'ERR_VALIDATION' | 'ERR_UPSTREAM_UNAVAILABLE',
  message: string,
  action: string,
  correlationId: string,
  setCookieHeader?: string,
): Response {
  const headers = new Headers({ 'X-Correlation-Id': correlationId });
  if (setCookieHeader) {
    headers.append('Set-Cookie', setCookieHeader);
  }
  return Response.json(createPublicAppError({ code, status, message, action, correlationId }), {
    status,
    headers,
  });
}

export function loader({ request, context }: Route.LoaderArgs): Response {
  const correlationId = getOrCreateCorrelationId(request, context);
  return Response.json(
    createPublicAppError({
      code: 'ERR_VALIDATION',
      status: 405,
      message: 'Method not allowed.',
      action: 'Send a POST request to stream ask responses.',
      correlationId,
    }),
    { status: 405, headers: { Allow: 'POST', 'X-Correlation-Id': correlationId } },
  );
}

export async function action({ request, context }: Route.ActionArgs): Promise<Response> {
  const { sessionId, setCookieHeader } = resolveGuestSession(request);
  const reqCtx = getRequestContext(context);
  const correlationId = getOrCreateCorrelationId(request, context);
  const logger = reqCtx?.logger ?? createFallbackLogger('portal-ask-stream');
  triggerPortalGuestSessionBinding(request, sessionId, logger);

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return jsonErrorResponse(
      400,
      'ERR_VALIDATION',
      'Malformed streaming ask payload.',
      'Review your question and retry.',
      correlationId,
      setCookieHeader,
    );
  }

  const body =
    rawBody && typeof rawBody === 'object' && !Array.isArray(rawBody)
      ? (rawBody as Record<string, unknown>)
      : {};
  const mode = typeof body['mode'] === 'string' && body['mode'].trim() ? body['mode'].trim() : 'qa';
  if (mode !== 'qa') {
    return jsonErrorResponse(
      400,
      'ERR_VALIDATION',
      'Streaming endpoint supports qa mode only.',
      'Submit JD Match requests through /chat.',
      correlationId,
      setCookieHeader,
    );
  }

  const question = typeof body['question'] === 'string' ? body['question'].trim() : '';
  if (question.length < 4 || question.length > 800) {
    return jsonErrorResponse(
      400,
      'ERR_VALIDATION',
      'Question must be between 4 and 800 characters.',
      'Adjust your question and retry.',
      correlationId,
      setCookieHeader,
    );
  }

  const rawAttemptId = typeof body['attemptId'] === 'string' ? body['attemptId'].trim() : '';
  const attemptId = rawAttemptId || randomUUID();
  if (!UUID_RE.test(attemptId)) {
    return jsonErrorResponse(
      400,
      'ERR_VALIDATION',
      'Invalid submission attempt identifier.',
      'Refresh and submit again.',
      correlationId,
      setCookieHeader,
    );
  }

  const rawConvId = typeof body['conversationId'] === 'string' ? body['conversationId'].trim() : '';
  if (rawConvId && !UUID_RE.test(rawConvId)) {
    return jsonErrorResponse(
      400,
      'ERR_VALIDATION',
      'Invalid conversation identifier.',
      'Start a new conversation and retry.',
      correlationId,
      setCookieHeader,
    );
  }

  const rawVisitorLens = typeof body['visitorLens'] === 'string' ? body['visitorLens'].trim() : '';
  if (rawVisitorLens && !VISITOR_LENS_RE.test(rawVisitorLens)) {
    return jsonErrorResponse(
      400,
      'ERR_VALIDATION',
      'Invalid visitor lens identifier.',
      'Choose a supported visitor lens and retry.',
      correlationId,
      setCookieHeader,
    );
  }
  const visitorLens = rawVisitorLens;

  const aiAskUrl = process.env['AI_ASK_URL']?.trim();
  if (!aiAskUrl) {
    return jsonErrorResponse(
      503,
      'ERR_UPSTREAM_UNAVAILABLE',
      'Upstream service unreachable.',
      'Retry shortly or go home.',
      correlationId,
      setCookieHeader,
    );
  }

  const extraResponseHeaders = setCookieHeader ? { 'Set-Cookie': setCookieHeader } : undefined;
  const upstream = await proxyPostSse({
    baseUrl: aiAskUrl,
    path: '/v1/ask/stream',
    body: {
      mode: 'qa',
      question,
      attemptId,
      ...(rawConvId ? { conversationId: rawConvId } : {}),
      ...(visitorLens ? { visitorLens } : {}),
    },
    extraResponseHeaders,
    headerTimeoutMs: resolveAskStreamHeaderTimeoutMs(),
    signal: request.signal,
    internalAuth: { role: 'guest', subject: sessionId },
    correlationId,
    source: 'portal.api.ask.stream',
    logger,
  });

  // Normalize unreachable upstream transport errors (502) to 503 while preserving Set-Cookie and PublicAppError body.
  if (!upstream.ok && upstream.status === 502) {
    const rawText = await upstream.text().catch(() => '');
    const headers = new Headers(upstream.headers);
    try {
      const parsed = JSON.parse(rawText) as Record<string, unknown>;
      if (parsed['code'] === 'ERR_UPSTREAM_UNAVAILABLE') {
        return new Response(JSON.stringify({ ...parsed, status: 503 }), {
          status: 503,
          headers,
        });
      }
    } catch {
      // fall through
    }
    return new Response(rawText, { status: 503, headers });
  }

  return upstream;
}
