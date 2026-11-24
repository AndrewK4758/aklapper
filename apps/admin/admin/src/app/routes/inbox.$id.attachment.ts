import { classifyServerError } from '@aklapper/core/server-errors';
import { getContactSubmissionAttachment, getSharedDb } from '@aklapper/db';
import {
  createFallbackLogger,
  getOrCreateCorrelationId,
  getRequestContext,
  logDiagnosticError,
} from '@aklapper/node-runtime/ssr/stream';

import { requireAdminSession, sanitizeDownloadFilename } from '../admin-ops.server';
import type { Route } from './+types/inbox.$id.attachment';

export async function loader({ request, params, context }: Route.LoaderArgs): Promise<Response> {
  const correlationId = getOrCreateCorrelationId(request, context);
  const reqCtx = getRequestContext(context);
  const logger = reqCtx?.logger ?? createFallbackLogger('admin-attachment');
  const baseHeaders = { 'X-Correlation-Id': correlationId };

  await requireAdminSession(request, {
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

  let attachment: Awaited<ReturnType<typeof getContactSubmissionAttachment>>;
  try {
    attachment = await getContactSubmissionAttachment(getSharedDb(), id);
  } catch (error) {
    const { publicError, diagnostic } = classifyServerError(error, {
      correlationId,
      source: 'admin.inbox.attachment',
    });
    logDiagnosticError(logger, diagnostic);
    return Response.json(publicError, {
      status: publicError.status,
      headers: baseHeaders,
    });
  }

  if (!attachment) {
    return Response.json(
      { error: 'NOT_FOUND', message: 'Attachment not found.' },
      { status: 404, headers: baseHeaders },
    );
  }

  const decoded = Buffer.from(attachment.attachmentContentBase64, 'base64');
  const bytes = new Uint8Array(decoded.buffer, decoded.byteOffset, decoded.byteLength);
  const safeName = sanitizeDownloadFilename(attachment.attachmentName);

  return new Response(bytes, {
    status: 200,
    headers: {
      'content-type': attachment.attachmentMimeType || 'application/octet-stream',
      'content-disposition': `attachment; filename="${safeName}"`,
      'content-length': String(bytes.byteLength),
      'x-content-type-options': 'nosniff',
      'cache-control': 'private, no-store',
      'X-Correlation-Id': correlationId,
    },
  });
}
