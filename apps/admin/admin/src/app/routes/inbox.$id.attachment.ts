import { getContactSubmissionAttachment, getSharedDb } from '@aklapper/db';
import type { LoaderFunctionArgs } from 'react-router';

import { requireAdminSession, sanitizeDownloadFilename } from '../admin-ops.server';

export async function loader({ request, params }: LoaderFunctionArgs): Promise<Response> {
  await requireAdminSession(request);

  const id = params['id']?.trim() ?? '';
  if (!id) {
    return Response.json(
      { error: 'NOT_FOUND', message: 'Attachment ID required.' },
      { status: 404 },
    );
  }

  const attachment = await getContactSubmissionAttachment(getSharedDb(), id);
  if (!attachment) {
    return Response.json({ error: 'NOT_FOUND', message: 'Attachment not found.' }, { status: 404 });
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
    },
  });
}
