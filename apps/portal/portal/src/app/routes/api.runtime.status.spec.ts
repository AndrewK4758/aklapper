import http2 from 'node:http2';
import type { AddressInfo } from 'node:net';

import { RuntimeServiceHealthSnapshotSchema } from '@aklapper/core';
import { clearGoGrpcTransportCacheForTest } from '@aklapper/node-runtime/grpc';
import { clearRuntimeHealthCacheForTest } from '@aklapper/node-runtime/runtime-health';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { loader } from './api.runtime.status';

// gRPC length-prefixed proto3 HealthCheckResponse { status: SERVING (1) }
const GRPC_HEALTH_SERVING_FRAME = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x02, 0x08, 0x01]);

async function startHealthH2CServer(): Promise<{
  readonly baseUrl: string;
  readonly getCalls: () => readonly string[];
  readonly close: () => Promise<void>;
}> {
  const calls: string[] = [];
  const server = http2.createServer();
  server.on('stream', (stream: http2.ServerHttp2Stream, headers) => {
    const path = String(headers[':path'] ?? '');
    calls.push(path);
    stream.on('data', () => undefined);
    stream.on('end', () => {
      stream.respond(
        {
          ':status': 200,
          'content-type': 'application/grpc+proto',
        },
        { waitForTrailers: true },
      );
      stream.on('wantTrailers', () => {
        stream.sendTrailers({ 'grpc-status': '0' });
      });
      stream.end(GRPC_HEALTH_SERVING_FRAME);
    });
  });

  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${addr.port}`,
    getCalls: () => calls,
    close: () =>
      new Promise<void>(resolve => {
        server.close(() => resolve());
      }),
  };
}

describe('portal /api/runtime/status resource route', () => {
  afterEach(() => {
    clearRuntimeHealthCacheForTest();
    clearGoGrpcTransportCacheForTest();
    vi.restoreAllMocks();
    delete process.env['AI_ASK_URL'];
    delete process.env['CADENCE_DEMO_URL'];
  });

  it('probes ai-ask and cadence-demo over gRPC Health/Check and serves cached snapshot within TTL window', async () => {
    const askSrv = await startHealthH2CServer();
    const cadSrv = await startHealthH2CServer();
    try {
      process.env['AI_ASK_URL'] = askSrv.baseUrl;
      process.env['CADENCE_DEMO_URL'] = cadSrv.baseUrl;

      const req1 = new Request('https://andrew-k.us/api/runtime/status');
      const res1 = await loader({
        request: req1,
        params: {},
        context: {} as never,
        url: new URL('https://andrew-k.us/api/runtime/status'),
        pattern: '/api/runtime/status',
      } as never);

      expect(res1.status).toBe(200);
      expect(res1.headers.get('X-Correlation-Id')).toBeTruthy();
      const body1 = RuntimeServiceHealthSnapshotSchema.parse(await res1.json());
      expect(body1.cached).toBe(false);
      expect(body1.services.find(s => s.service === 'ai-ask')?.status).toBe('healthy');
      expect(body1.services.find(s => s.service === 'cadence-demo')?.status).toBe('healthy');
      expect(askSrv.getCalls()).toEqual(['/grpc.health.v1.Health/Check']);
      expect(cadSrv.getCalls()).toEqual(['/grpc.health.v1.Health/Check']);

      const req2 = new Request('https://andrew-k.us/api/runtime/status');
      const res2 = await loader({
        request: req2,
        params: {},
        context: {} as never,
        url: new URL('https://andrew-k.us/api/runtime/status'),
        pattern: '/api/runtime/status',
      } as never);

      expect(res2.status).toBe(200);
      const body2 = RuntimeServiceHealthSnapshotSchema.parse(await res2.json());
      expect(body2.cached).toBe(true);
      expect(askSrv.getCalls()).toHaveLength(1);
      expect(cadSrv.getCalls()).toHaveLength(1);
    } finally {
      await Promise.all([askSrv.close(), cadSrv.close()]);
    }
  });
});
