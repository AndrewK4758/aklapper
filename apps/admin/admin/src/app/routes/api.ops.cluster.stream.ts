import type { K8sPodEvent } from '@aklapper/core';
import { proxySse } from '@aklapper/node-runtime/http';
import type { LoaderFunctionArgs } from 'react-router';

import { requireAdminSession } from '../admin-ops.server';

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
  {
    eventId: 'sim-ops-contact',
    namespace: 'portfolio-public',
    deployment: 'svc-contact',
    podName: 'svc-contact-0',
    phase: 'ScaledZero',
    message: 'Idle at 0/1 replicas (scale-to-0)',
    ready: false,
  },
  {
    eventId: 'sim-ops-cadence-admin',
    namespace: 'cadence-admin',
    deployment: 'cadence-admin',
    podName: 'cadence-admin-0',
    phase: 'ScaledZero',
    message: 'Isolated cadence-admin runtime idle at 0/1 replicas',
    ready: false,
  },
];

function createSimulatedDualNamespaceStream(): Response {
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
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    },
  });
}

export async function loader({ request }: LoaderFunctionArgs): Promise<Response> {
  await requireAdminSession(request);

  const watchUrl = process.env['K8S_WATCH_URL']?.trim();
  if (!watchUrl) {
    return createSimulatedDualNamespaceStream();
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
    return createSimulatedDualNamespaceStream();
  }

  return upstream;
}
