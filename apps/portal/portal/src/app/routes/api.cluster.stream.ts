import type { K8sPodEvent } from '@aklapper/core';
import { proxySse } from '@aklapper/node-runtime/http';

const SIMULATED_PUBLIC_EVENTS: readonly Omit<K8sPodEvent, 'timestamp'>[] = [
  {
    eventId: 'sim-cadence-demo',
    namespace: 'portfolio-public',
    deployment: 'svc-cadence-demo',
    podName: 'svc-cadence-demo-0',
    phase: 'ScaledZero',
    message: 'Idle at 0/1 replicas (scale-to-0)',
    ready: false,
  },
  {
    eventId: 'sim-ai-ask',
    namespace: 'portfolio-public',
    deployment: 'svc-ai-ask',
    podName: 'svc-ai-ask-0',
    phase: 'ScaledZero',
    message: 'Idle at 0/1 replicas (scale-to-0)',
    ready: false,
  },
  {
    eventId: 'sim-contact',
    namespace: 'portfolio-public',
    deployment: 'svc-contact',
    podName: 'svc-contact-0',
    phase: 'ScaledZero',
    message: 'Idle at 0/1 replicas (scale-to-0)',
    ready: false,
  },
];

function createSimulatedPublicStream(): Response {
  const now = new Date().toISOString();
  const body = SIMULATED_PUBLIC_EVENTS.map(ev => {
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

export async function loader({ request }: { request: Request }): Promise<Response> {
  const watchUrl = process.env['K8S_WATCH_URL']?.trim();
  if (!watchUrl) {
    return createSimulatedPublicStream();
  }

  // Strictly read-only public namespace stream: NEVER attach admin internal auth tokens here.
  const upstream = await proxySse({
    baseUrl: watchUrl,
    path: '/v1/cluster/stream',
    timeoutMs: 3_000,
    signal: request.signal,
  });

  if (!upstream.ok) {
    return createSimulatedPublicStream();
  }

  return upstream;
}
