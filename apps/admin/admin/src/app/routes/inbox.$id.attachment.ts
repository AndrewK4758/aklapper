import {
  classifyGrpcError,
  openAdminContactAttachmentStreamViaGrpc,
} from '@aklapper/node-runtime/grpc';
import {
  createFallbackLogger,
  getOrCreateCorrelationId,
  getRequestContext,
} from '@aklapper/node-runtime/ssr/stream';

import { buildAttachmentContentDisposition, requireAdminSession } from '../admin-ops.server';
import type { Route } from './+types/inbox.$id.attachment';

export async function loader({ request, params, context }: Route.LoaderArgs): Promise<Response> {
  const correlationId = getOrCreateCorrelationId(request, context);
  const reqCtx = getRequestContext(context);
  const logger = reqCtx?.logger ?? createFallbackLogger('admin-attachment');
  const baseHeaders = { 'X-Correlation-Id': correlationId };

  const { session } = await requireAdminSession(request, {
    context,
    source: 'admin.inbox.attachment',
    mode: 'resource',
  });

  const id = params.id.trim();
  if (!id) {
    return Response.json(
      { error: 'NOT_FOUND', message: 'Attachment ID required.' },
      { status: 404, headers: baseHeaders },
    );
  }

  let streamed: Awaited<ReturnType<typeof openAdminContactAttachmentStreamViaGrpc>>;
  try {
    streamed = await openAdminContactAttachmentStreamViaGrpc(session.sessionId, id, {
      correlationId,
      logger,
      signal: reqCtx?.signal ?? request.signal,
    });
  } catch (error) {
    const { publicError } = classifyGrpcError(error, {
      correlationId,
      source: 'admin.inbox.attachment',
      normalizeUnavailableStatus: 503,
      logger,
    });
    if (publicError.status === 404) {
      return Response.json(
        { error: 'NOT_FOUND', message: 'Attachment not found.' },
        { status: 404, headers: baseHeaders },
      );
    }
    return Response.json(publicError, {
      status: publicError.status,
      headers: baseHeaders,
    });
  }

  try {
    const contentDisposition = buildAttachmentContentDisposition(streamed.metadata.filename);
    const headers: Record<string, string> = {
      'content-type': streamed.metadata.mimeType || 'application/octet-stream',
      'content-disposition': contentDisposition,
      'x-content-type-options': 'nosniff',
      'cache-control': 'private, no-store',
      'X-Correlation-Id': correlationId,
    };
    if (streamed.metadata.sizeBytes > 0) {
      headers['content-length'] = String(streamed.metadata.sizeBytes);
    }

    return new Response(streamed.body, {
      status: 200,
      headers,
    });
  } catch (error) {
    await streamed.body.cancel().catch(() => undefined);
    const { publicError } = classifyGrpcError(error, {
      correlationId,
      source: 'admin.inbox.attachment',
      normalizeUnavailableStatus: 503,
      logger,
    });
    return Response.json(publicError, {
      status: publicError.status,
      headers: baseHeaders,
    });
  }
}
