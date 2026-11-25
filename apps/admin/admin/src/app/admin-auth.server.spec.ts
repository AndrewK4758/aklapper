import { isPublicAppError } from '@aklapper/core';
import { requestContextKey } from '@aklapper/node-runtime/ssr/stream';
import { RouterContextProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { requireAdminSession } from './admin-auth.server';

type LogFn = (obj: Record<string, unknown>, msg?: string) => void;

function makeMockLogger() {
  return {
    info: vi.fn<LogFn>(),
    warn: vi.fn<LogFn>(),
    error: vi.fn<LogFn>(),
  };
}

describe('requireAdminSession', () => {
  const originalDatabaseUrl = process.env['DATABASE_URL'];
  const originalAuthApiUrl = process.env['AUTH_API_URL'];

  beforeEach(() => {
    delete process.env['DATABASE_URL'];
    delete process.env['AUTH_API_URL'];
  });

  afterEach(() => {
    if (originalDatabaseUrl === undefined) {
      delete process.env['DATABASE_URL'];
    } else {
      process.env['DATABASE_URL'] = originalDatabaseUrl;
    }
    if (originalAuthApiUrl === undefined) {
      delete process.env['AUTH_API_URL'];
    } else {
      process.env['AUTH_API_URL'] = originalAuthApiUrl;
    }
    vi.restoreAllMocks();
  });

  it('rejects unauthenticated requests carrying unrelated cookies with HTTP 401 even when DATABASE_URL is unset', async () => {
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

  it('classifies DB outages during admin session verification to HTTP 503 data response in UI mode', async () => {
    const logger = makeMockLogger();
    const context = new RouterContextProvider();
    context.set(requestContextKey, {
      correlationId: 'corr-auth-ui-503',
      logger,
      serviceName: 'admin-ssr',
      signal: new AbortController().signal,
    });

    const request = new Request('http://localhost:4301/cms', {
      headers: { cookie: 'ak_admin_session=session-token-123' },
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
    expect(logger.error).toHaveBeenCalledTimes(1);
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

  it('classifies DB outages during admin session verification to HTTP 503 JSON Response in resource mode', async () => {
    const logger = makeMockLogger();
    const context = new RouterContextProvider();
    context.set(requestContextKey, {
      correlationId: 'corr-auth-res-503',
      logger,
      serviceName: 'admin-ssr',
      signal: new AbortController().signal,
    });

    const request = new Request('http://localhost:4301/inbox/sub-1/attachment', {
      headers: { cookie: 'ak_admin_session=session-token-123' },
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
        code: 'ERR_DB_UNAVAILABLE',
        correlationId: 'corr-auth-res-503',
      }),
    );
    expect(logger.error).toHaveBeenCalledTimes(1);
  });
});
