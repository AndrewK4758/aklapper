import { probeRuntimeServices } from '@aklapper/node-runtime/runtime-health';
import { getOrCreateCorrelationId } from '@aklapper/node-runtime/ssr/stream';

import type { Route } from './+types/api.runtime.status';

const PORTAL_RUNTIME_TTL_MS = 60_000;
const PORTAL_RUNTIME_TIMEOUT_MS = 1_500;

export async function loader({ request, context }: Route.LoaderArgs): Promise<Response> {
  const correlationId = getOrCreateCorrelationId(request, context);
  const snapshot = await probeRuntimeServices({
    services: [
      { service: 'portal', localStatus: 'healthy', detail: 'SSR ready' },
      { service: 'portal-api', url: process.env['PORTAL_API_URL'], transport: 'grpc' },
      { service: 'ai-ask', url: process.env['AI_ASK_URL'], transport: 'grpc' },
      { service: 'cadence-demo', url: process.env['CADENCE_DEMO_URL'], transport: 'grpc' },
    ],
    timeoutMs: PORTAL_RUNTIME_TIMEOUT_MS,
    ttlMs: PORTAL_RUNTIME_TTL_MS,
    cacheKey: 'portal-runtime-status',
    correlationId,
  });

  return Response.json(snapshot, {
    status: 200,
    headers: {
      'cache-control': 'public, max-age=30',
      'X-Correlation-Id': correlationId,
    },
  });
}
