import type { K8sPodEvent } from '@aklapper/core';
import { proxySse } from '@aklapper/node-runtime/http';
import { getOrCreateCorrelationId } from '@aklapper/node-runtime/ssr/stream';

import { requireAdminSession } from '../admin-ops.server';
import type { Route } from './+types/api.ops.cluster.stream';

const SIMULATED_ADMIN_CLUSTER_EVENTS: readonly Omit<K8sPodEvent, 'timestamp'>[] = [
  {
    eventId: 'sim-ops-cadence-demo',
    namespace: 'portfolio-public',
    deployment: 'svc-cadence-demo',
    podName: 'svc-cadence-demo-0',
    phase: 'ScaledZero',
    message: 'Idle at 0/1 replicas (scale-to-0)',
    ready: false,
  },
  {
    eventId: 'sim-ops-ai-ask',
    namespace: 'portfolio-public',
    deployment: 'svc-ai-ask',
    podName: 'svc-ai-ask-0',
    phase: 'ScaledZero',
    message: 'Idle at 0/1 replicas (scale-to-0)',
    ready: false,
  },
];

function createSimulatedClusterStream(correlationId: string): Response {
  const now = new Date().toISOString();
  const body = SIMULATED_ADMIN_CLUSTER_EVENTS.map(ev => {
    const payload: K8sPodEvent = { ...ev, timestamp: now };
    return `event: pod\ndata: ${JSON.stringify(payload)}\n\n`;
  }).join('');

  return new Response(body, {
    status: 200,
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache',
      'x-accel-buffering': 'no',
      'X-Correlation-Id': correlationId,
    },
  });
}

export async function loader({ request, context }: Route.LoaderArgs): Promise<Response> {
  const correlationId = getOrCreateCorrelationId(request, context);
  await requireAdminSession(request, {
    context,
    source: 'admin.ops.cluster.stream',
    mode: 'resource',
  });

  const watchUrl = process.env['K8S_WATCH_URL']?.trim();
  if (!watchUrl) {
    return createSimulatedClusterStream(correlationId);
  }

  const upstream = await proxySse({
    baseUrl: watchUrl,
    path: '/v1/cluster/stream',
    timeoutMs: 3_000,
    signal: request.signal,
    internalAuth: {
      role: 'admin',
      subject: 'admin-ops-stream',
    },
  });

  if (!upstream.ok) {
    return createSimulatedClusterStream(correlationId);
  }

  const headers = new Headers(upstream.headers);
  headers.set('X-Correlation-Id', correlationId);
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}
