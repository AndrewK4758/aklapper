import { isPublicAppError } from '@aklapper/core';
import { classifyGrpcError } from '@aklapper/node-runtime/grpc';
import type { SsrStructuredLogger } from '@aklapper/node-runtime/ssr/stream';

export interface AdminStreamRpcOptions {
  readonly correlationId: string;
  readonly source: string;
  readonly logger?: SsrStructuredLogger;
}

/**
 * Executes an Admin SSR gRPC loader call and normalizes gRPC failures into a wire-safe
 * PublicAppError before deferStreamResult settles, preserving exact HTTP/code hierarchies.
 */
export async function runAdminStreamRpc<T>(
  call: () => Promise<T>,
  options: AdminStreamRpcOptions,
): Promise<T> {
  try {
    return await call();
  } catch (error) {
    if (isPublicAppError(error)) {
      throw error;
    }
    const failure = classifyGrpcError(error, {
      correlationId: options.correlationId,
      source: options.source,
      normalizeUnavailableStatus: 503,
      ...(options.logger ? { logger: options.logger } : {}),
    });
    throw failure.publicError;
  }
}
