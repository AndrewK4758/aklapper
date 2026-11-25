import { PublicAppErrorSchema } from '@aklapper/core';
import { describe, expect, it, vi } from 'vitest';

import { proxySse } from '../src/http.ts';

describe('hardened GET proxySse', () => {
  it('enforces headerTimeoutMs on stalled headers, preserves streams past headerTimeoutMs, and strips Connection: keep-alive', async () => {
    // 1. Stream headers arrive in 10ms, body emits for 120ms (> headerTimeoutMs 50ms) -> succeeds.
    const slowBody = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(encoder.encode('event: log\ndata: {"line":"step 1"}\n\n'));
        setTimeout(() => {
          controller.enqueue(encoder.encode('event: log\ndata: {"line":"step 2"}\n\n'));
          controller.close();
        }, 90);
      },
    });

    const okRes = await proxySse({
      baseUrl: 'http://cadence-demo.internal:8082',
      path: '/v1/cadence/runs/11111111-1111-4111-8111-111111111111/stream',
      headerTimeoutMs: 50,
      oidcAuth: false,
      fetchImpl: async () =>
        new Response(slowBody, {
          status: 200,
          headers: {
            'content-type': 'text/event-stream; charset=utf-8',
            connection: 'keep-alive',
          },
        }),
    });

    expect(okRes.status).toBe(200);
    expect(okRes.headers.get('connection')).toBeNull();
    expect(okRes.headers.get('x-accel-buffering')).toBe('no');
    const bodyText = await okRes.text();
    expect(bodyText).toContain('step 1');
    expect(bodyText).toContain('step 2');

    // 2. Stalled response headers past headerTimeoutMs -> 504 ERR_STREAM_TIMEOUT.
    const timeoutRes = await proxySse({
      baseUrl: 'http://cadence-demo.internal:8082',
      path: '/v1/cadence/runs/11111111-1111-4111-8111-111111111111/stream',
      headerTimeoutMs: 30,
      oidcAuth: false,
      fetchImpl: (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(init.signal?.reason ?? new DOMException('Aborted', 'AbortError'));
          });
        }),
    });

    expect(timeoutRes.status).toBe(504);
    const timeoutJson = PublicAppErrorSchema.parse(await timeoutRes.json());
    expect(timeoutJson.code).toBe('ERR_STREAM_TIMEOUT');
  });

  it('maps network errors to 502 and redacts non-2xx upstream error bodies via PublicAppError', async () => {
    const netErrRes = await proxySse({
      baseUrl: 'http://cadence-demo.internal:8082',
      path: '/v1/cadence/runs/11111111-1111-4111-8111-111111111111/stream',
      oidcAuth: false,
      fetchImpl: vi.fn<typeof fetch>().mockRejectedValueOnce(new Error('connect ECONNREFUSED')),
    });

    expect(netErrRes.status).toBe(502);
    const netJson = PublicAppErrorSchema.parse(await netErrRes.json());
    expect(netJson.code).toBe('ERR_UPSTREAM_UNAVAILABLE');
    expect(netJson.message).not.toContain('ECONNREFUSED');

    const raw500Res = await proxySse({
      baseUrl: 'http://cadence-demo.internal:8082',
      path: '/v1/cadence/runs/11111111-1111-4111-8111-111111111111/stream',
      oidcAuth: false,
      fetchImpl: async () =>
        new Response('FATAL: password authentication failed for postgres://secret', {
          status: 500,
        }),
    });

    expect(raw500Res.status).toBe(503);
    const redacted500 = PublicAppErrorSchema.parse(await raw500Res.json());
    expect(redacted500.message).not.toContain('postgres://secret');

    const conflictRes = await proxySse({
      baseUrl: 'http://cadence-demo.internal:8082',
      path: '/v1/cadence/runs/11111111-1111-4111-8111-111111111111/stream',
      oidcAuth: false,
      fetchImpl: async () =>
        new Response(JSON.stringify({ error: 'internal stack trace secret' }), { status: 409 }),
    });

    expect(conflictRes.status).toBe(409);
    const redacted409 = PublicAppErrorSchema.parse(await conflictRes.json());
    expect(redacted409.code).toBe('ERR_CONSTRAINT');
    expect(redacted409.message).not.toContain('internal stack trace');
  });
});
