import {
  AdminInboxItemSchema,
  AdminInboxLoaderDataSchema,
  InboxVisitorContextSchema,
  type AdminInboxItem,
  type AdminInboxLoaderData,
  type InboxVisitorContext,
} from '@aklapper/core';
import { create } from '@bufbuild/protobuf';
import { createClient } from '@connectrpc/connect';

import { createFallbackLogger } from '../request-context.ts';
import {
  buildAdminGrpcCallMeta,
  rethrowAdminGrpcError,
  type AdminGrpcCallContext,
} from './admin-common.ts';
import { classifyAdminGrpcError, GrpcPayloadContractError } from './errors.ts';
import {
  AdminInboxService,
  DeleteContactSubmissionRequestSchema,
  DeleteContactSubmissionsRequestSchema,
  ListContactSubmissionsRequestSchema,
  StreamContactAttachmentRequestSchema,
  type AdminInboxItem as ProtoInboxItem,
  type ContactAttachmentMetadata,
  type InboxVisitorContext as ProtoVisitorContext,
} from './gen/admin/v1/inbox_pb.ts';
import {
  getOrCreateGoGrpcTransport,
  invokeUnaryWithAuth,
  openServerStreamWithAuth,
} from './transport.ts';

function createInboxClient(sessionId: string, ctx: AdminGrpcCallContext = {}) {
  const meta = buildAdminGrpcCallMeta({ ...ctx, sessionId, role: 'admin' });
  return {
    client: createClient(AdminInboxService, getOrCreateGoGrpcTransport(meta.baseUrl)),
    meta,
  };
}

function mapProtoVisitorContext(
  proto: ProtoVisitorContext | undefined,
): InboxVisitorContext | null {
  if (!proto) return null;
  return InboxVisitorContextSchema.parse({
    analyticsSessionId: proto.analyticsSessionId ?? null,
    guestSessionId: proto.guestSessionId ?? null,
    country: proto.country ?? null,
    region: proto.region ?? null,
    city: proto.city ?? null,
    asnOrg: proto.asnOrg ?? null,
    referrerHost: proto.referrerHost ?? null,
    referrerCategory: proto.referrerCategory ?? null,
    landingPath: proto.landingPath ?? null,
    refParam: proto.refParam ?? null,
    utmSource: proto.utmSource ?? null,
    utmCampaign: proto.utmCampaign ?? null,
    deviceType: proto.deviceType ?? null,
    osName: proto.osName ?? null,
    browserName: proto.browserName ?? null,
    viewedPaths: [...proto.viewedPaths],
    paneOpenCount: proto.paneOpenCount,
    askTurnCount: proto.askTurnCount,
    latestAskPromptExcerpt: proto.latestAskPromptExcerpt ?? null,
    startedAt: proto.startedAt ?? null,
    lastSeenAt: proto.lastSeenAt ?? null,
  });
}

function mapProtoInboxItem(proto: ProtoInboxItem): AdminInboxItem {
  return AdminInboxItemSchema.parse({
    id: proto.id,
    name: proto.name,
    email: proto.email,
    phone: proto.phone ?? null,
    message: proto.message,
    attachmentName: proto.attachmentName ?? null,
    attachmentMimeType: proto.attachmentMimeType ?? null,
    attachmentSizeBytes: proto.attachmentSizeBytes ?? null,
    attachmentSha256: proto.attachmentSha256 ?? null,
    visitorContext: mapProtoVisitorContext(proto.visitorContext),
    createdAt: proto.createdAt,
  });
}

export async function listAdminContactSubmissionsViaGrpc(
  sessionId: string,
  options: {
    readonly query?: string;
    readonly page?: number;
    readonly pageSize?: number;
    readonly selectedId?: string | null;
  } = {},
  ctx: AdminGrpcCallContext = {},
): Promise<AdminInboxLoaderData> {
  const { client, meta } = createInboxClient(sessionId, ctx);
  try {
    const res = await invokeUnaryWithAuth(
      '/admin.v1.AdminInboxService/ListContactSubmissions',
      meta,
      opts =>
        client.listContactSubmissions(
          create(ListContactSubmissionsRequestSchema, {
            query: options.query ?? '',
            page: options.page ?? 1,
            pageSize: options.pageSize ?? 20,
            ...(options.selectedId ? { selectedId: options.selectedId } : {}),
          }),
          opts,
        ),
    );
    return AdminInboxLoaderDataSchema.parse({
      items: res.items.map(mapProtoInboxItem),
      totalCount: res.totalCount,
      page: res.page,
      pageSize: res.pageSize,
      query: res.query,
      selectedId: res.selectedId ?? null,
      selectedItem: res.selectedItem ? mapProtoInboxItem(res.selectedItem) : null,
    });
  } catch (error) {
    rethrowAdminGrpcError(error, 'admin.inbox.list', ctx);
  }
}

export async function deleteAdminContactSubmissionViaGrpc(
  sessionId: string,
  id: string,
  ctx: AdminGrpcCallContext = {},
): Promise<boolean> {
  const { client, meta } = createInboxClient(sessionId, ctx);
  try {
    const res = await invokeUnaryWithAuth(
      '/admin.v1.AdminInboxService/DeleteContactSubmission',
      meta,
      opts =>
        client.deleteContactSubmission(create(DeleteContactSubmissionRequestSchema, { id }), opts),
    );
    return res.deleted;
  } catch (error) {
    rethrowAdminGrpcError(error, 'admin.inbox.delete', ctx);
  }
}

export async function deleteAdminContactSubmissionsViaGrpc(
  sessionId: string,
  ids: readonly string[],
  ctx: AdminGrpcCallContext = {},
): Promise<number> {
  const { client, meta } = createInboxClient(sessionId, ctx);
  try {
    const res = await invokeUnaryWithAuth(
      '/admin.v1.AdminInboxService/DeleteContactSubmissions',
      meta,
      opts =>
        client.deleteContactSubmissions(
          create(DeleteContactSubmissionsRequestSchema, { ids: [...ids] }),
          opts,
        ),
    );
    return res.deletedCount;
  } catch (error) {
    rethrowAdminGrpcError(error, 'admin.inbox.delete_bulk', ctx);
  }
}

export interface StreamedContactAttachment {
  readonly metadata: {
    readonly id: string;
    readonly filename: string;
    readonly mimeType: string;
    readonly sizeBytes: number;
    readonly sha256: string;
  };
  readonly body: ReadableStream<Uint8Array>;
}

/**
 * Opens the chunked gRPC attachment stream, reads the leading metadata frame, and exposes a
 * streaming Web ReadableStream<Uint8Array> without buffering the attachment in Node SSR memory.
 */
export async function openAdminContactAttachmentStreamViaGrpc(
  sessionId: string,
  submissionId: string,
  ctx: AdminGrpcCallContext = {},
): Promise<StreamedContactAttachment> {
  const { client, meta } = createInboxClient(sessionId, ctx);
  const logger = ctx.logger ?? createFallbackLogger('admin-inbox');
  const iterable = openServerStreamWithAuth(
    '/admin.v1.AdminInboxService/StreamContactAttachment',
    meta,
    opts =>
      client.streamContactAttachment(
        create(StreamContactAttachmentRequestSchema, { submissionId }),
        opts,
      ),
  );
  const iterator = iterable[Symbol.asyncIterator]();

  let firstMetadata: ContactAttachmentMetadata | undefined;
  let bufferedFirstChunk: Uint8Array | undefined;
  try {
    const first = await iterator.next();
    if (first.done || !first.value) {
      throw new GrpcPayloadContractError('ContactAttachmentMetadata', 'Empty attachment stream');
    }
    if (first.value.chunk.case === 'metadata') {
      firstMetadata = first.value.chunk.value;
    } else if (first.value.chunk.case === 'data') {
      bufferedFirstChunk = first.value.chunk.value;
    }
    if (!firstMetadata) {
      throw new GrpcPayloadContractError(
        'ContactAttachmentMetadata',
        'Attachment stream missing leading metadata frame',
      );
    }
  } catch (error) {
    await iterator.return?.().catch(() => undefined);
    const failure = classifyAdminGrpcError(error, {
      correlationId: meta.correlationId,
      source: 'admin.inbox.attachment',
      ...(ctx.logger ? { logger: ctx.logger } : {}),
    });
    logger.warn(
      {
        seam_type: 'BOUNDARY_FAULT',
        event: 'admin.inbox.attachment_stream_failed',
        submissionId,
        code: failure.publicError.code,
        status: failure.publicError.status,
        correlationId: meta.correlationId,
      },
      'Admin contact attachment stream failed before metadata flush',
    );
    throw error;
  }

  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        if (bufferedFirstChunk) {
          const pending = bufferedFirstChunk;
          bufferedFirstChunk = undefined;
          controller.enqueue(pending);
          return;
        }
        const next = await iterator.next();
        if (next.done) {
          controller.close();
          return;
        }
        if (next.value.chunk.case === 'data' && next.value.chunk.value.byteLength > 0) {
          controller.enqueue(next.value.chunk.value);
        }
      } catch (error) {
        logger.warn(
          {
            seam_type: 'BOUNDARY_FAULT',
            event: 'admin.inbox.attachment_stream_failed',
            submissionId,
            reason: 'mid_stream_fault',
            correlationId: meta.correlationId,
          },
          'Admin contact attachment stream faulted mid-transfer',
        );
        controller.error(error);
      }
    },
    async cancel() {
      await iterator.return?.().catch(() => undefined);
    },
  });

  return {
    metadata: {
      id: firstMetadata.id,
      filename: firstMetadata.filename,
      mimeType: firstMetadata.mimeType,
      sizeBytes: Number(firstMetadata.sizeBytes),
      sha256: firstMetadata.sha256,
    },
    body,
  };
}
