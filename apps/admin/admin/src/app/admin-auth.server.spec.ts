import { isPublicAppError } from '@aklapper/core';
import {
  clearGoGrpcTransportCacheForTest,
  Code,
  ConnectError,
  ErrorDetailEnvelopeSchema,
  PublicAppErrorSchema,
} from '@aklapper/node-runtime/grpc';
import { requestContextKey } from '@aklapper/node-runtime/ssr/stream';
import { create, toBinary } from '@bufbuild/protobuf';
import { RouterContextProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const grpcMocks = vi.hoisted(() => ({
  resolveAdminSessionViaGrpc: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
}));

vi.mock('@aklapper/node-runtime/grpc', async importOriginal => {
  const actual = await importOriginal<typeof import('@aklapper/node-runtime/grpc')>();
  return {
    ...actual,
    resolveAdminSessionViaGrpc: (...args: unknown[]) =>
      grpcMocks.resolveAdminSessionViaGrpc(...args),
  };
});

import { requireAdminSession } from './admin-auth.server';

type LogFn = (obj: Record<string, unknown>, msg?: string) => void;

function makeMockLogger() {
  return {
    info: vi.fn<LogFn>(),
    warn: vi.fn<LogFn>(),
    error: vi.fn<LogFn>(),
  };
}

function makeDbUnavailableConnectError(): ConnectError {
  const err = new ConnectError('database unavailable', Code.Unavailable);
  const envelope = create(ErrorDetailEnvelopeSchema, {
    error: create(PublicAppErrorSchema, {
      code: 'ERR_DB_UNAVAILABLE',
      status: 503,
      message: 'Database temporarily unavailable.',
      action: 'Retry shortly or share ID.',
      correlationId: 'corr-db-503',
    }),
  });
  err.details.push({
    type: 'common.v1.ErrorDetailEnvelope',
    value: toBinary(ErrorDetailEnvelopeSchema, envelope),
  });
  return err;
}

describe('requireAdminSession', () => {
  beforeEach(() => {
    grpcMocks.resolveAdminSessionViaGrpc.mockReset();
  });

  afterEach(() => {
    clearGoGrpcTransportCacheForTest();
    vi.restoreAllMocks();
  });

  it('rejects unauthenticated requests carrying unrelated cookies with HTTP 401', async () => {
    grpcMocks.resolveAdminSessionViaGrpc.mockResolvedValueOnce({
      authenticated: false,
      session: null,
      totpEnabled: false,
      passkeyCount: 0,
    });
    const request = new Request('http://localhost:4301/cms', {
      headers: {
        cookie: 'ak_guest_sid=guest-123; theme=solar-forge',
        'x-correlation-id': 'corr-auth-401',
      },
    });

    const thrown = await requireAdminSession(request, {
      context: new RouterContextProvider(),
      source: 'admin.cms.loader',
      mode: 'ui',
    }).catch((err: unknown) => err);

    expect(thrown).toBeInstanceOf(Response);
    const response = thrown as Response;
    expect(response.status).toBe(401);
    expect(response.headers.get('X-Correlation-Id')).toBe('corr-auth-401');
    expect(await response.json()).toEqual({
      error: 'UNAUTHORIZED',
      message: 'Verified admin session required.',
    });
  });

  it('classifies admin-api outages during admin session verification to HTTP 503 data response in UI mode', async () => {
    const logger = makeMockLogger();
    const context = new RouterContextProvider();
    context.set(requestContextKey, {
      correlationId: 'corr-auth-ui-503',
      logger,
      serviceName: 'admin-ssr',
      signal: new AbortController().signal,
    });
    grpcMocks.resolveAdminSessionViaGrpc.mockRejectedValueOnce(makeDbUnavailableConnectError());

    const request = new Request('http://localhost:4301/cms', {
      headers: { cookie: 'ak_admin_session=11111111-1111-4111-8111-111111111111' },
    });

    const thrown = await requireAdminSession(request, {
      context,
      source: 'admin.cms.loader',
      mode: 'ui',
    }).catch((err: unknown) => err);

    expect(thrown).not.toBeInstanceOf(Response);
    const dataError = thrown as {
      type?: string;
      data?: unknown;
      init?: { status?: number; headers?: Record<string, string> };
    };
    expect(dataError.type).toBe('DataWithResponseInit');
    expect(dataError.init?.status).toBe(503);
    expect(dataError.init?.headers?.['X-Correlation-Id']).toBe('corr-auth-ui-503');
    expect(isPublicAppError(dataError.data)).toBe(true);
    expect(dataError.data).toEqual(
      expect.objectContaining({
        code: 'ERR_DB_UNAVAILABLE',
        correlationId: 'corr-auth-ui-503',
      }),
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: 'ERR_DB_UNAVAILABLE',
        httpStatus: 503,
        correlationId: 'corr-auth-ui-503',
        source: 'admin.cms.loader',
      }),
      expect.any(String),
    );
  });

  it('classifies admin-api transport outages to HTTP 503 JSON Response in resource mode', async () => {
    const logger = makeMockLogger();
    const context = new RouterContextProvider();
    context.set(requestContextKey, {
      correlationId: 'corr-auth-res-503',
      logger,
      serviceName: 'admin-ssr',
      signal: new AbortController().signal,
    });
    grpcMocks.resolveAdminSessionViaGrpc.mockRejectedValueOnce(
      new ConnectError('dial tcp 127.0.0.1:8085: connect: connection refused', Code.Unavailable),
    );

    const request = new Request('http://localhost:4301/inbox/sub-1/attachment', {
      headers: { cookie: 'ak_admin_session=11111111-1111-4111-8111-111111111111' },
    });

    const thrown = await requireAdminSession(request, {
      context,
      source: 'admin.inbox.attachment',
      mode: 'resource',
    }).catch((err: unknown) => err);

    expect(thrown).toBeInstanceOf(Response);
    const response = thrown as Response;
    expect(response.status).toBe(503);
    expect(response.headers.get('X-Correlation-Id')).toBe('corr-auth-res-503');
    const body: unknown = await response.json();
    expect(isPublicAppError(body)).toBe(true);
    expect(body).toEqual(
      expect.objectContaining({
        code: 'ERR_UPSTREAM_UNAVAILABLE',
        correlationId: 'corr-auth-res-503',
      }),
    );
    expect(logger.error).toHaveBeenCalled();
  });
});
