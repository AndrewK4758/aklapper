import { classifyServerError } from '@aklapper/core/server-errors';
import { handleAnalyticsIngestRequest } from '@aklapper/db/analytics';
import {
  createFallbackLogger,
  getOrCreateCorrelationId,
  getRequestContext,
  logDiagnosticError,
} from '@aklapper/node-runtime/ssr/stream';

import type { Route } from './+types/api.analytics.ingest';

export async function action({ request, context }: Route.ActionArgs): Promise<Response> {
  const reqCtx = getRequestContext(context);
  const correlationId = getOrCreateCorrelationId(request, context);
  const logger = reqCtx?.logger ?? createFallbackLogger('portal-analytics-ingest');

  try {
    const response = await handleAnalyticsIngestRequest(request);
    const headers = new Headers(response.headers);
    headers.set('X-Correlation-Id', correlationId);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch (error) {
    const { publicError, diagnostic } = classifyServerError(error, {
      correlationId,
      source: 'portal.analytics.ingest',
    });
    logDiagnosticError(logger, diagnostic);
    return Response.json(publicError, {
      status: publicError.status,
      headers: { 'X-Correlation-Id': correlationId },
    });
  }
}
