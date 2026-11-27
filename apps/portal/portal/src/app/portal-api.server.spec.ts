import net, { type AddressInfo } from 'node:net';

import {
  clearGoGrpcTransportCacheForTest,
  Code,
  ConnectError,
  ErrorDetailEnvelopeSchema,
  PublicAppErrorSchema,
  startPortalApiStubServerForTest,
} from '@aklapper/node-runtime/grpc';
import {
  deferStreamResult,
  requestContextKey,
  type SsrStructuredLogger,
} from '@aklapper/node-runtime/ssr/stream';
import { create } from '@bufbuild/protobuf';
import { RouterContextProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  loadPortalCadenceDataWithPrerender,
  loadPortalHomeDataWithPrerender,
} from './portal-api.server';

type FaultMode = 'db_unavailable' | 'deadline_exceeded' | 'permission_denied';

function buildConnectFault(mode: FaultMode): ConnectError {
  if (mode === 'db_unavailable') {
    return new ConnectError('pg pool down', Code.Unavailable, undefined, [
      {
        desc: ErrorDetailEnvelopeSchema,
        value: create(ErrorDetailEnvelopeSchema, {
          error: create(PublicAppErrorSchema, {
            code: 'ERR_DB_UNAVAILABLE',
            status: 503,
            message: 'Database temporarily unavailable.',
            action: 'Retry shortly or share ID.',
            correlationId: 'corr-upstream-db',
          }),
        }),
      },
    ]);
  }
  if (mode === 'deadline_exceeded') {
    return new ConnectError('rpc deadline exceeded after 3500ms', Code.DeadlineExceeded);
  }
  return new ConnectError('permission denied by upstream', Code.PermissionDenied);
}

async function allocateClosedLocalPort(): Promise<number> {
  const probe = net.createServer();
  await new Promise<void>(resolveListen => {
    probe.listen(0, '127.0.0.1', () => resolveListen());
  });
  const port = (probe.address() as AddressInfo).port;
  await new Promise<void>(resolveClose => probe.close(() => resolveClose()));
  return port;
}

function makeStreamContext(correlationId: string) {
  const errorCalls: Array<Record<string, unknown>> = [];
  const logger: SsrStructuredLogger = {
    info: vi.fn<(obj: Record<string, unknown>, msg?: string) => void>(),
    warn: vi.fn<(obj: Record<string, unknown>, msg?: string) => void>(),
    error: vi.fn<(obj: Record<string, unknown>, msg?: string) => void>(obj => {
      errorCalls.push(obj);
    }),
  };
  const context = new RouterContextProvider();
  context.set(requestContextKey, {
    correlationId,
    logger,
    serviceName: 'portal-ssr',
    signal: new AbortController().signal,
  });
  return { context, logger, errorCalls };
}

describe('portal-api.server ConnectRPC error hierarchy preservation across deferStreamResult', () => {
  const origPortalUrl = process.env['PORTAL_API_URL'];
  const origCadenceUrl = process.env['CADENCE_DEMO_URL'];
  const origSecret = process.env['INTERNAL_AUTH_SECRET'];

  afterEach(() => {
    clearGoGrpcTransportCacheForTest();
    if (origPortalUrl === undefined) delete process.env['PORTAL_API_URL'];
    else process.env['PORTAL_API_URL'] = origPortalUrl;
    if (origCadenceUrl === undefined) delete process.env['CADENCE_DEMO_URL'];
    else process.env['CADENCE_DEMO_URL'] = origCadenceUrl;
    if (origSecret === undefined) delete process.env['INTERNAL_AUTH_SECRET'];
    else process.env['INTERNAL_AUTH_SECRET'] = origSecret;
    vi.restoreAllMocks();
  });

  it('preserves 503 ERR_DB_UNAVAILABLE, 504 ERR_STREAM_TIMEOUT, 403 ERR_FORBIDDEN, and 503 ERR_UPSTREAM_UNAVAILABLE (ECONNREFUSED) over live h2c', async () => {
    process.env['INTERNAL_AUTH_SECRET'] = 'portal-api-server-spec-secret-0123456789';
    let mode: FaultMode = 'db_unavailable';
    const srv = await startPortalApiStubServerForTest({
      beforeProcedure: procedure => {
        if (procedure === 'getHomeContent' || procedure === 'listCadenceRuns') {
          throw buildConnectFault(mode);
        }
      },
    });

    try {
      process.env['PORTAL_API_URL'] = srv.baseUrl;
      process.env['CADENCE_DEMO_URL'] = srv.baseUrl;

      // (a) Code.Unavailable + ERR_DB_UNAVAILABLE -> 503 ERR_DB_UNAVAILABLE
      mode = 'db_unavailable';
      const dbCtx = makeStreamContext('corr-live-db-503');
      const dbResult = await deferStreamResult(
        loadPortalHomeDataWithPrerender({
          correlationId: 'corr-live-db-503',
          logger: dbCtx.logger,
        }),
        {
          request: new Request('https://andrew-k.us/'),
          context: dbCtx.context,
          source: 'portal.home.loader',
        },
      );
      expect(dbResult).toEqual({
        ok: false,
        error: expect.objectContaining({
          code: 'ERR_DB_UNAVAILABLE',
          status: 503,
          message: 'Database temporarily unavailable.',
          correlationId: 'corr-live-db-503',
        }),
      });

      // (b) Code.DeadlineExceeded -> 504 ERR_STREAM_TIMEOUT
      mode = 'deadline_exceeded';
      const timeoutCtx = makeStreamContext('corr-live-timeout-504');
      const timeoutResult = await deferStreamResult(
        loadPortalHomeDataWithPrerender({
          correlationId: 'corr-live-timeout-504',
          logger: timeoutCtx.logger,
        }),
        {
          request: new Request('https://andrew-k.us/'),
          context: timeoutCtx.context,
          source: 'portal.home.loader',
        },
      );
      expect(timeoutResult).toEqual({
        ok: false,
        error: expect.objectContaining({
          code: 'ERR_STREAM_TIMEOUT',
          status: 504,
          message: 'Section took too long to load.',
          correlationId: 'corr-live-timeout-504',
        }),
      });

      // (c) Code.PermissionDenied -> 403 ERR_FORBIDDEN (tested on both home and cadence listCadenceRuns)
      mode = 'permission_denied';
      const permCtx = makeStreamContext('corr-live-perm-403');
      const permResult = await deferStreamResult(
        loadPortalHomeDataWithPrerender({
          correlationId: 'corr-live-perm-403',
          logger: permCtx.logger,
        }),
        {
          request: new Request('https://andrew-k.us/'),
          context: permCtx.context,
          source: 'portal.home.loader',
        },
      );
      expect(permResult).toEqual({
        ok: false,
        error: expect.objectContaining({
          code: 'ERR_FORBIDDEN',
          status: 403,
          message: 'Permission denied for action.',
          correlationId: 'corr-live-perm-403',
        }),
      });

      const cadenceCtx = makeStreamContext('corr-live-cadence-403');
      const cadenceResult = await deferStreamResult(
        loadPortalCadenceDataWithPrerender('guest_live_1', {
          correlationId: 'corr-live-cadence-403',
          logger: cadenceCtx.logger,
        }),
        {
          request: new Request('https://andrew-k.us/cadence'),
          context: cadenceCtx.context,
          source: 'portal.cadence.loader',
        },
      );
      expect(cadenceResult).toEqual({
        ok: false,
        error: expect.objectContaining({
          code: 'ERR_FORBIDDEN',
          status: 403,
          correlationId: 'corr-live-cadence-403',
        }),
      });

      // (d) Live ECONNREFUSED on closed port -> 503 ERR_UPSTREAM_UNAVAILABLE ("Upstream service unreachable.")
      const closedPort = await allocateClosedLocalPort();
      process.env['PORTAL_API_URL'] = `http://127.0.0.1:${closedPort}`;
      const connRefusedCtx = makeStreamContext('corr-live-econnrefused-503');
      const connRefusedResult = await deferStreamResult(
        loadPortalHomeDataWithPrerender({
          correlationId: 'corr-live-econnrefused-503',
          logger: connRefusedCtx.logger,
        }),
        {
          request: new Request('https://andrew-k.us/'),
          context: connRefusedCtx.context,
          source: 'portal.home.loader',
        },
      );
      expect(connRefusedResult).toEqual({
        ok: false,
        error: expect.objectContaining({
          code: 'ERR_UPSTREAM_UNAVAILABLE',
          status: 503,
          message: 'Upstream service unreachable.',
          correlationId: 'corr-live-econnrefused-503',
        }),
      });
    } finally {
      await srv.close();
    }
  });
});
