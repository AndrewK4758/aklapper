import type { AuthSessionStatus } from '@aklapper/core';
import { classifyGrpcError, resolveAdminSessionViaGrpc } from '@aklapper/node-runtime/grpc';
import {
  createFallbackLogger,
  getOrCreateCorrelationId,
  getRequestContext,
} from '@aklapper/node-runtime/ssr/stream';
import { data, type RouterContextProvider } from 'react-router';

export interface AuthenticatedAdminContext {
  status: AuthSessionStatus;
  session: NonNullable<AuthSessionStatus['session']>;
}

export interface RequireAdminSessionOptions {
  readonly context?: Readonly<RouterContextProvider>;
  readonly source?: string;
  readonly mode?: 'ui' | 'resource';
}

export async function requireAdminSession(
  request: Request,
  options: RequireAdminSessionOptions = {},
): Promise<AuthenticatedAdminContext> {
  const correlationId = getOrCreateCorrelationId(request, options.context);
  const reqCtx = getRequestContext(options.context);
  const logger = reqCtx?.logger ?? createFallbackLogger('admin-auth');
  const headers = { 'X-Correlation-Id': correlationId };

  let status: AuthSessionStatus;
  try {
    status = await resolveAdminSessionViaGrpc(request, {
      correlationId,
      logger,
      signal: reqCtx?.signal ?? request.signal,
    });
  } catch (error) {
    const { publicError } = classifyGrpcError(error, {
      correlationId,
      source: options.source ?? 'admin.auth.session',
      normalizeUnavailableStatus: 503,
      logger,
    });
    if (options.mode === 'resource') {
      throw Response.json(publicError, { status: publicError.status, headers });
    }
    throw data(publicError, { status: publicError.status, headers });
  }

  if (!status.authenticated || !status.session || status.session.role !== 'admin') {
    throw Response.json(
      { error: 'UNAUTHORIZED', message: 'Verified admin session required.' },
      { status: 401, headers },
    );
  }

  return { status, session: status.session };
}
