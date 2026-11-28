import type {
  AdminTerminalCommandRow,
  AdminTerminalDirectoryEntryRow,
  AdminTerminalInitialEntryRow,
  AdminTerminalProfileRow,
  TerminalCommandUpsertInput,
  TerminalDirectoryEntryUpsertInput,
  TerminalInitialEntryUpsertInput,
  TerminalProfileUpsertInput,
} from '@aklapper/core';
import { create } from '@bufbuild/protobuf';
import { createClient } from '@connectrpc/connect';

import {
  mapProtoAdminTerminalCommand,
  mapProtoAdminTerminalDirectoryEntry,
  mapProtoAdminTerminalInitialEntry,
  mapProtoAdminTerminalProfile,
} from './admin-cms-mappers.ts';
import {
  buildAdminGrpcCallMeta,
  rethrowAdminGrpcError,
  type AdminGrpcCallContext,
} from './admin-common.ts';
import { GrpcPayloadContractError } from './errors.ts';
import {
  AdminCmsService,
  DeleteTerminalCommandRequestSchema,
  DeleteTerminalDirectoryEntryRequestSchema,
  DeleteTerminalInitialEntryRequestSchema,
  UpsertTerminalCommandRequestSchema,
  UpsertTerminalDirectoryEntryRequestSchema,
  UpsertTerminalInitialEntryRequestSchema,
  UpsertTerminalProfileRequestSchema,
} from './gen/admin/v1/cms_pb.ts';
import { getOrCreateGoGrpcTransport, invokeUnaryWithAuth } from './transport.ts';

function createTerminalCmsClient(sessionId: string, ctx: AdminGrpcCallContext = {}) {
  const meta = buildAdminGrpcCallMeta({ ...ctx, sessionId, role: 'admin' });
  return {
    client: createClient(AdminCmsService, getOrCreateGoGrpcTransport(meta.baseUrl)),
    meta,
  };
}

export async function upsertAdminTerminalProfileViaGrpc(
  sessionId: string,
  input: TerminalProfileUpsertInput,
  ctx: AdminGrpcCallContext = {},
): Promise<AdminTerminalProfileRow> {
  const { client, meta } = createTerminalCmsClient(sessionId, ctx);
  try {
    const res = await invokeUnaryWithAuth(
      '/admin.v1.AdminCmsService/UpsertTerminalProfile',
      meta,
      opts =>
        client.upsertTerminalProfile(
          create(UpsertTerminalProfileRequestSchema, {
            ...input,
            quickCommands: [...input.quickCommands],
          }),
          opts,
        ),
    );
    if (!res.profile) throw new GrpcPayloadContractError('AdminTerminalProfileRow');
    return mapProtoAdminTerminalProfile(res.profile);
  } catch (error) {
    rethrowAdminGrpcError(error, 'admin.cms.terminal_profile', ctx);
  }
}

export async function upsertAdminTerminalCommandViaGrpc(
  sessionId: string,
  input: TerminalCommandUpsertInput,
  ctx: AdminGrpcCallContext = {},
): Promise<AdminTerminalCommandRow> {
  const { client, meta } = createTerminalCmsClient(sessionId, ctx);
  try {
    const res = await invokeUnaryWithAuth(
      '/admin.v1.AdminCmsService/UpsertTerminalCommand',
      meta,
      opts =>
        client.upsertTerminalCommand(
          create(UpsertTerminalCommandRequestSchema, {
            ...(input.id !== undefined ? { id: input.id } : {}),
            profileSlug: input.profileSlug,
            name: input.name,
            description: input.description,
            kind: input.kind,
            output: input.output,
            ...(input.targetRoute ? { targetRoute: input.targetRoute } : {}),
            allowedRoutes: [...input.allowedRoutes],
            ...(input.errorTemplate ? { errorTemplate: input.errorTemplate } : {}),
            sortOrder: input.sortOrder,
          }),
          opts,
        ),
    );
    if (!res.command) throw new GrpcPayloadContractError('AdminTerminalCommandRow');
    return mapProtoAdminTerminalCommand(res.command);
  } catch (error) {
    rethrowAdminGrpcError(error, 'admin.cms.terminal_command', ctx);
  }
}

export async function deleteAdminTerminalCommandViaGrpc(
  sessionId: string,
  id: number,
  ctx: AdminGrpcCallContext = {},
): Promise<boolean> {
  const { client, meta } = createTerminalCmsClient(sessionId, ctx);
  try {
    const res = await invokeUnaryWithAuth(
      '/admin.v1.AdminCmsService/DeleteTerminalCommand',
      meta,
      opts =>
        client.deleteTerminalCommand(create(DeleteTerminalCommandRequestSchema, { id }), opts),
    );
    return res.deleted;
  } catch (error) {
    rethrowAdminGrpcError(error, 'admin.cms.terminal_command_delete', ctx);
  }
}

export async function upsertAdminTerminalInitialEntryViaGrpc(
  sessionId: string,
  input: TerminalInitialEntryUpsertInput,
  ctx: AdminGrpcCallContext = {},
): Promise<AdminTerminalInitialEntryRow> {
  const { client, meta } = createTerminalCmsClient(sessionId, ctx);
  try {
    const res = await invokeUnaryWithAuth(
      '/admin.v1.AdminCmsService/UpsertTerminalInitialEntry',
      meta,
      opts =>
        client.upsertTerminalInitialEntry(
          create(UpsertTerminalInitialEntryRequestSchema, {
            ...(input.id !== undefined ? { id: input.id } : {}),
            profileSlug: input.profileSlug,
            command: input.command,
            output: input.output,
            status: input.status,
            durationLabel: input.durationLabel,
            timestampLabel: input.timestampLabel,
            sortOrder: input.sortOrder,
          }),
          opts,
        ),
    );
    if (!res.entry) throw new GrpcPayloadContractError('AdminTerminalInitialEntryRow');
    return mapProtoAdminTerminalInitialEntry(res.entry);
  } catch (error) {
    rethrowAdminGrpcError(error, 'admin.cms.terminal_initial_entry', ctx);
  }
}

export async function deleteAdminTerminalInitialEntryViaGrpc(
  sessionId: string,
  id: number,
  ctx: AdminGrpcCallContext = {},
): Promise<boolean> {
  const { client, meta } = createTerminalCmsClient(sessionId, ctx);
  try {
    const res = await invokeUnaryWithAuth(
      '/admin.v1.AdminCmsService/DeleteTerminalInitialEntry',
      meta,
      opts =>
        client.deleteTerminalInitialEntry(
          create(DeleteTerminalInitialEntryRequestSchema, { id }),
          opts,
        ),
    );
    return res.deleted;
  } catch (error) {
    rethrowAdminGrpcError(error, 'admin.cms.terminal_initial_entry_delete', ctx);
  }
}

export async function upsertAdminTerminalDirectoryEntryViaGrpc(
  sessionId: string,
  input: TerminalDirectoryEntryUpsertInput,
  ctx: AdminGrpcCallContext = {},
): Promise<AdminTerminalDirectoryEntryRow> {
  const { client, meta } = createTerminalCmsClient(sessionId, ctx);
  try {
    const res = await invokeUnaryWithAuth(
      '/admin.v1.AdminCmsService/UpsertTerminalDirectoryEntry',
      meta,
      opts =>
        client.upsertTerminalDirectoryEntry(
          create(UpsertTerminalDirectoryEntryRequestSchema, {
            ...(input.id !== undefined ? { id: input.id } : {}),
            profileSlug: input.profileSlug,
            name: input.name,
            description: input.description,
            sortOrder: input.sortOrder,
            enabled: input.enabled,
          }),
          opts,
        ),
    );
    if (!res.entry) throw new GrpcPayloadContractError('AdminTerminalDirectoryEntryRow');
    return mapProtoAdminTerminalDirectoryEntry(res.entry);
  } catch (error) {
    rethrowAdminGrpcError(error, 'admin.cms.terminal_directory_entry', ctx);
  }
}

export async function deleteAdminTerminalDirectoryEntryViaGrpc(
  sessionId: string,
  id: number,
  ctx: AdminGrpcCallContext = {},
): Promise<boolean> {
  const { client, meta } = createTerminalCmsClient(sessionId, ctx);
  try {
    const res = await invokeUnaryWithAuth(
      '/admin.v1.AdminCmsService/DeleteTerminalDirectoryEntry',
      meta,
      opts =>
        client.deleteTerminalDirectoryEntry(
          create(DeleteTerminalDirectoryEntryRequestSchema, { id }),
          opts,
        ),
    );
    return res.deleted;
  } catch (error) {
    rethrowAdminGrpcError(error, 'admin.cms.terminal_directory_entry_delete', ctx);
  }
}
