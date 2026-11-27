import http from 'node:http';
import http2 from 'node:http2';
import type { AddressInfo } from 'node:net';

import { RuntimeServiceHealthSnapshotSchema } from '@aklapper/core';
import { clearGoGrpcTransportCacheForTest } from '@aklapper/node-runtime/grpc';
import { clearRuntimeHealthCacheForTest } from '@aklapper/node-runtime/runtime-health';
import { afterEach, describe, expect, it, vi } from 'vitest';

const requireAdminSessionMock = vi.fn<(...args: unknown[]) => Promise<unknown>>();

vi.mock('../admin-ops.server', async () => {
  const actual = await vi.importActual<typeof import('../admin-ops.server')>('../admin-ops.server');
  return {
    ...actual,
    requireAdminSession: (...args: unknown[]) => requireAdminSessionMock(...args),
  };
});

import { loader } from './api.ops.runtime.status';

const GRPC_HEALTH_SERVING_FRAME = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x02, 0x08, 0x01]);

async function startGrpcHealthServer(): Promise<{
  readonly baseUrl: string;
  readonly getCalls: () => readonly string[];
  readonly close: () => Promise<void>;
}> {
  const calls: string[] = [];
  const server = http2.createServer();
  server.on('stream', (stream: http2.ServerHttp2Stream, headers) => {
    calls.push(String(headers[':path'] ?? ''));
    stream.on('data', () => undefined);
    stream.on('end', () => {
      stream.respond(
        { ':status': 200, 'content-type': 'application/grpc+proto' },
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
    close: () => new Promise<void>(resolve => server.close(() => resolve())),
  };
}

async function startPortalHttpHealthServer(): Promise<{
  readonly baseUrl: string;
  readonly getCalls: () => readonly string[];
  readonly close: () => Promise<void>;
}> {
  const calls: string[] = [];
  const server = http.createServer((req, res) => {
    calls.push(req.url ?? '');
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'portal' }));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${addr.port}`,
    getCalls: () => calls,
    close: () => new Promise<void>(resolve => server.close(() => resolve())),
  };
}

describe('admin /api/ops/runtime/status resource route', () => {
  afterEach(() => {
    clearRuntimeHealthCacheForTest();
    clearGoGrpcTransportCacheForTest();
    requireAdminSessionMock.mockReset();
    vi.restoreAllMocks();
    delete process.env['PUBLIC_PORTAL_URL'];
    delete process.env['AI_ASK_URL'];
    delete process.env['CADENCE_DEMO_URL'];
  });

  it('returns HTTP 401 verbatim and emits UNSOUND_CONDITION telemetry when unauthenticated', async () => {
    const unauthorizedResponse = Response.json(
      { error: 'UNAUTHORIZED', message: 'Verified admin session required.' },
      { status: 401, headers: { 'X-Correlation-Id': 'corr-unauth-1' } },
    );
    requireAdminSessionMock.mockRejectedValueOnce(unauthorizedResponse);

    const warnLogs: string[] = [];
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation((msg: unknown) => {
      warnLogs.push(String(msg));
    });

    try {
      let caught: unknown;
      try {
        await loader({
          request: new Request('https://admin.andrew-k.us/api/ops/runtime/status'),
          params: {},
          context: {} as never,
          url: new URL('https://admin.andrew-k.us/api/ops/runtime/status'),
          pattern: '/api/ops/runtime/status',
        } as never);
      } catch (err) {
        caught = err;
      }

      expect(caught).toBe(unauthorizedResponse);
      expect((caught as Response).status).toBe(401);
      expect(warnLogs.join('\n')).toContain('admin.ops.unauthenticated_runtime_status');
      expect(warnLogs.join('\n')).toContain('UNSOUND_CONDITION');
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('discriminates HTTP /health for portal and gRPC Health/Check for Go services and bypasses TTL cache on ?refresh=1', async () => {
    requireAdminSessionMock.mockResolvedValue({
      session: { role: 'admin', handle: 'admin' },
      correlationId: 'corr-auth-1',
    });

    const portalSrv = await startPortalHttpHealthServer();
    const askSrv = await startGrpcHealthServer();
    // Bind and immediately close a server to get a guaranteed-offline loopback port for cadence-demo.
    const offlineSrv = await startGrpcHealthServer();
    const offlineUrl = offlineSrv.baseUrl;
    await offlineSrv.close();

    try {
      process.env['PUBLIC_PORTAL_URL'] = portalSrv.baseUrl;
      process.env['AI_ASK_URL'] = askSrv.baseUrl;
      process.env['CADENCE_DEMO_URL'] = offlineUrl;

      const res1 = await loader({
        request: new Request('https://admin.andrew-k.us/api/ops/runtime/status'),
        params: {},
        context: {} as never,
        url: new URL('https://admin.andrew-k.us/api/ops/runtime/status'),
        pattern: '/api/ops/runtime/status',
      } as never);
      expect(res1.status).toBe(200);
      const snap1 = RuntimeServiceHealthSnapshotSchema.parse(await res1.json());
      expect(snap1.cached).toBe(false);
      expect(snap1.services.find(s => s.service === 'portal')?.status).toBe('healthy');
      expect(snap1.services.find(s => s.service === 'ai-ask')?.status).toBe('healthy');
      expect(snap1.services.find(s => s.service === 'cadence-demo')?.status).toBe('offline');
      expect(portalSrv.getCalls()).toEqual(['/health']);
      expect(askSrv.getCalls()).toEqual(['/grpc.health.v1.Health/Check']);

      const res2 = await loader({
        request: new Request('https://admin.andrew-k.us/api/ops/runtime/status?refresh=1'),
        params: {},
        context: {} as never,
        url: new URL('https://admin.andrew-k.us/api/ops/runtime/status?refresh=1'),
        pattern: '/api/ops/runtime/status',
      } as never);
      expect(res2.status).toBe(200);
      const snap2 = RuntimeServiceHealthSnapshotSchema.parse(await res2.json());
      expect(snap2.cached).toBe(false);
      expect(portalSrv.getCalls()).toHaveLength(2);
      expect(askSrv.getCalls()).toHaveLength(2);
    } finally {
      await Promise.all([portalSrv.close(), askSrv.close()]);
    }
  });
});
