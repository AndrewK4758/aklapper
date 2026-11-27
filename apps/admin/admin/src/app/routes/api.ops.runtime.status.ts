import { probeRuntimeServices } from '@aklapper/node-runtime/runtime-health';
import { getOrCreateCorrelationId } from '@aklapper/node-runtime/ssr/stream';

import { requireAdminSession } from '../admin-ops.server';
import type { Route } from './+types/api.ops.runtime.status';

const ADMIN_RUNTIME_TTL_MS = 30_000;
const ADMIN_RUNTIME_TIMEOUT_MS = 1_500;

export async function loader({ request, context }: Route.LoaderArgs): Promise<Response> {
  const correlationId = getOrCreateCorrelationId(request, context);
  try {
    await requireAdminSession(request, {
      context,
      source: 'admin.ops.runtime.status',
      mode: 'resource',
    });
  } catch (error) {
    if (error instanceof Response) {
      console.warn(
        JSON.stringify({
          event: 'admin.ops.unauthenticated_runtime_status',
          seam: 'UNSOUND_CONDITION',
          httpStatus: error.status,
          correlationId,
        }),
      );
    }
    throw error;
  }

  const requestUrl = new URL(request.url);
  const bypassCache = requestUrl.searchParams.get('refresh') === '1';

  const snapshot = await probeRuntimeServices({
    services: [
      { service: 'admin', localStatus: 'healthy', detail: 'SSR ready' },
      {
        service: 'portal',
        url: process.env['PUBLIC_PORTAL_URL'],
        transport: 'http',
        oidcAuth: false,
      },
      { service: 'portal-api', url: process.env['PORTAL_API_URL'], transport: 'grpc' },
      { service: 'ai-ask', url: process.env['AI_ASK_URL'], transport: 'grpc' },
      { service: 'cadence-demo', url: process.env['CADENCE_DEMO_URL'], transport: 'grpc' },
    ],
    timeoutMs: ADMIN_RUNTIME_TIMEOUT_MS,
    ttlMs: ADMIN_RUNTIME_TTL_MS,
    bypassCache,
    cacheKey: 'admin-ops-runtime-status',
    correlationId,
  });

  return Response.json(snapshot, {
    status: 200,
    headers: {
      'cache-control': 'no-store',
      'X-Correlation-Id': correlationId,
    },
  });
}
