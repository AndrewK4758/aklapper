import {
  AdminChromeContentSchema,
  AdminCmsLoaderDataSchema,
  type AdminChromeContent,
  type AdminCmsLoaderData,
  type AgensiSkill,
  type AgensiSyncState,
  type CadencePreset,
  type CadencePresetUpsertInput,
  type MenuItem,
  type MenuItemUpsertInput,
  type SiteContentRow,
  type TerminalProfileData,
} from '@aklapper/core';
import { create } from '@bufbuild/protobuf';
import { createClient } from '@connectrpc/connect';

import {
  mapProtoAdminTerminalCommand,
  mapProtoAdminTerminalDirectoryEntry,
  mapProtoAdminTerminalInitialEntry,
  mapProtoAdminTerminalProfile,
  mapProtoMenuItem,
  mapProtoSiteContentRow,
} from './admin-cms-mappers.ts';
import {
  ADMIN_CHROME_SUBJECT,
  buildAdminGrpcCallMeta,
  parseAdminJsonObject,
  rethrowAdminGrpcError,
  type AdminGrpcCallContext,
} from './admin-common.ts';
import { GrpcPayloadContractError } from './errors.ts';
import {
  AdminCmsService,
  DeleteCadencePresetRequestSchema,
  DeleteMenuItemRequestSchema,
  GetAdminChromeRequestSchema,
  GetAdminWorkspaceBootstrapRequestSchema,
  GetCmsDataRequestSchema,
  SyncAgensiCatalogRequestSchema,
  UpsertCadencePresetRequestSchema,
  UpsertMenuItemRequestSchema,
  UpsertSiteContentRequestSchema,
} from './gen/admin/v1/cms_pb.ts';
import {
  mapProtoAgensiSkillToDomain,
  mapProtoAgensiSyncStateToDomain,
  mapProtoCadencePresetToDomain,
  mapProtoCareerDossierToDomain,
  mapProtoTerminalProfileToDomain,
} from './portal-mappers.ts';
import { getOrCreateGoGrpcTransport, invokeUnaryWithAuth } from './transport.ts';

function createCmsClient(ctx: AdminGrpcCallContext = {}) {
  const meta = buildAdminGrpcCallMeta(ctx);
  return {
    client: createClient(AdminCmsService, getOrCreateGoGrpcTransport(meta.baseUrl)),
    meta,
  };
}

export async function getAdminChromeViaGrpc(
  ctx: AdminGrpcCallContext = {},
): Promise<AdminChromeContent> {
  const { client, meta } = createCmsClient({
    ...ctx,
    role: ctx.sessionId ? 'admin' : 'service',
    subject: ctx.sessionId ? `admin-session:${ctx.sessionId}` : ADMIN_CHROME_SUBJECT,
  });
  try {
    const res = await invokeUnaryWithAuth('/admin.v1.AdminCmsService/GetAdminChrome', meta, opts =>
      client.getAdminChrome(create(GetAdminChromeRequestSchema, {}), opts),
    );
    return parseAdminJsonObject(res.chromeJson, 'AdminChromeContent', v =>
      AdminChromeContentSchema.parse(v),
    );
  } catch (error) {
    rethrowAdminGrpcError(error, 'admin.cms.chrome', ctx);
  }
}

export async function getAdminWorkspaceBootstrapViaGrpc(
  sessionId: string,
  ctx: AdminGrpcCallContext = {},
): Promise<{ readonly chrome: AdminChromeContent; readonly terminal: TerminalProfileData }> {
  const { client, meta } = createCmsClient({ ...ctx, sessionId, role: 'admin' });
  try {
    const res = await invokeUnaryWithAuth(
      '/admin.v1.AdminCmsService/GetAdminWorkspaceBootstrap',
      meta,
      opts =>
        client.getAdminWorkspaceBootstrap(
          create(GetAdminWorkspaceBootstrapRequestSchema, { sessionId }),
          opts,
        ),
    );
    const chrome = parseAdminJsonObject(res.chromeJson, 'AdminChromeContent', v =>
      AdminChromeContentSchema.parse(v),
    );
    if (!res.terminal) {
      throw new GrpcPayloadContractError('TerminalProfileData', 'Missing admin terminal profile');
    }
    return { chrome, terminal: mapProtoTerminalProfileToDomain(res.terminal) };
  } catch (error) {
    rethrowAdminGrpcError(error, 'admin.cms.bootstrap', ctx);
  }
}

export async function getAdminCmsDataViaGrpc(
  sessionId: string,
  creatorHandle?: string,
  ctx: AdminGrpcCallContext = {},
): Promise<AdminCmsLoaderData> {
  const { client, meta } = createCmsClient({ ...ctx, sessionId, role: 'admin' });
  try {
    const res = await invokeUnaryWithAuth('/admin.v1.AdminCmsService/GetCmsData', meta, opts =>
      client.getCmsData(
        create(GetCmsDataRequestSchema, creatorHandle ? { creatorHandle } : {}),
        opts,
      ),
    );
    return AdminCmsLoaderDataSchema.parse({
      siteContents: res.siteContents.map(mapProtoSiteContentRow),
      menuItems: res.menuItems.map(mapProtoMenuItem),
      terminalProfiles: res.terminalProfiles.map(mapProtoAdminTerminalProfile),
      terminalCommands: res.terminalCommands.map(mapProtoAdminTerminalCommand),
      terminalInitialEntries: res.terminalInitialEntries.map(mapProtoAdminTerminalInitialEntry),
      terminalDirectoryEntries: res.terminalDirectoryEntries.map(
        mapProtoAdminTerminalDirectoryEntry,
      ),
      agensiSkills: res.agensiSkills.map(s => mapProtoAgensiSkillToDomain(s)),
      agensiSyncState: mapProtoAgensiSyncStateToDomain(res.agensiSyncState),
      cadencePresets: res.cadencePresets.map(p => mapProtoCadencePresetToDomain(p)),
      careerDossiers: res.careerDossiers.map(d => mapProtoCareerDossierToDomain(d)),
    });
  } catch (error) {
    rethrowAdminGrpcError(error, 'admin.cms.load', ctx);
  }
}

export async function upsertAdminSiteContentViaGrpc(
  sessionId: string,
  input: {
    readonly key: string;
    readonly markdownBody: string;
    readonly metadataJson: Record<string, unknown>;
  },
  ctx: AdminGrpcCallContext = {},
): Promise<SiteContentRow> {
  const { client, meta } = createCmsClient({ ...ctx, sessionId, role: 'admin' });
  try {
    const res = await invokeUnaryWithAuth(
      '/admin.v1.AdminCmsService/UpsertSiteContent',
      meta,
      opts =>
        client.upsertSiteContent(
          create(UpsertSiteContentRequestSchema, {
            key: input.key,
            markdownBody: input.markdownBody,
            metadataJson: JSON.stringify(input.metadataJson),
          }),
          opts,
        ),
    );
    if (!res.row) throw new GrpcPayloadContractError('SiteContentRow');
    return mapProtoSiteContentRow(res.row);
  } catch (error) {
    rethrowAdminGrpcError(error, 'admin.cms.site_content', ctx);
  }
}

export async function upsertAdminMenuItemViaGrpc(
  sessionId: string,
  input: MenuItemUpsertInput,
  ctx: AdminGrpcCallContext = {},
): Promise<MenuItem> {
  const { client, meta } = createCmsClient({ ...ctx, sessionId, role: 'admin' });
  try {
    const res = await invokeUnaryWithAuth('/admin.v1.AdminCmsService/UpsertMenuItem', meta, opts =>
      client.upsertMenuItem(create(UpsertMenuItemRequestSchema, input), opts),
    );
    if (!res.item) throw new GrpcPayloadContractError('MenuItem');
    return mapProtoMenuItem(res.item);
  } catch (error) {
    rethrowAdminGrpcError(error, 'admin.cms.menu_upsert', ctx);
  }
}

export async function deleteAdminMenuItemViaGrpc(
  sessionId: string,
  slug: string,
  ctx: AdminGrpcCallContext = {},
): Promise<boolean> {
  const { client, meta } = createCmsClient({ ...ctx, sessionId, role: 'admin' });
  try {
    const res = await invokeUnaryWithAuth('/admin.v1.AdminCmsService/DeleteMenuItem', meta, opts =>
      client.deleteMenuItem(create(DeleteMenuItemRequestSchema, { slug }), opts),
    );
    return res.deleted;
  } catch (error) {
    rethrowAdminGrpcError(error, 'admin.cms.menu_delete', ctx);
  }
}

export async function upsertAdminCadencePresetViaGrpc(
  sessionId: string,
  input: CadencePresetUpsertInput,
  ctx: AdminGrpcCallContext = {},
): Promise<CadencePreset> {
  const { client, meta } = createCmsClient({ ...ctx, sessionId, role: 'admin' });
  try {
    const res = await invokeUnaryWithAuth(
      '/admin.v1.AdminCmsService/UpsertCadencePreset',
      meta,
      opts => client.upsertCadencePreset(create(UpsertCadencePresetRequestSchema, input), opts),
    );
    if (!res.preset) throw new GrpcPayloadContractError('CadencePreset');
    return mapProtoCadencePresetToDomain(res.preset);
  } catch (error) {
    rethrowAdminGrpcError(error, 'admin.cms.cadence_preset', ctx);
  }
}

export async function deleteAdminCadencePresetViaGrpc(
  sessionId: string,
  slug: string,
  ctx: AdminGrpcCallContext = {},
): Promise<boolean> {
  const { client, meta } = createCmsClient({ ...ctx, sessionId, role: 'admin' });
  try {
    const res = await invokeUnaryWithAuth(
      '/admin.v1.AdminCmsService/DeleteCadencePreset',
      meta,
      opts => client.deleteCadencePreset(create(DeleteCadencePresetRequestSchema, { slug }), opts),
    );
    return res.deleted;
  } catch (error) {
    rethrowAdminGrpcError(error, 'admin.cms.cadence_preset_delete', ctx);
  }
}

export async function syncAdminAgensiCatalogViaGrpc(
  sessionId: string,
  options: { readonly forceRefresh?: boolean; readonly creatorHandle?: string } = {},
  ctx: AdminGrpcCallContext = {},
): Promise<{
  readonly creatorHandle: string;
  readonly skills: readonly AgensiSkill[];
  readonly syncState: AgensiSyncState | null;
}> {
  const { client, meta } = createCmsClient({ ...ctx, sessionId, role: 'admin' });
  try {
    const res = await invokeUnaryWithAuth(
      '/admin.v1.AdminCmsService/SyncAgensiCatalog',
      meta,
      opts =>
        client.syncAgensiCatalog(
          create(SyncAgensiCatalogRequestSchema, {
            forceRefresh: options.forceRefresh ?? true,
            ...(options.creatorHandle ? { creatorHandle: options.creatorHandle } : {}),
          }),
          opts,
        ),
    );
    return {
      creatorHandle: res.creatorHandle,
      skills: res.skills.map(s => mapProtoAgensiSkillToDomain(s)),
      syncState: mapProtoAgensiSyncStateToDomain(res.syncState),
    };
  } catch (error) {
    rethrowAdminGrpcError(error, 'admin.cms.agensi_sync', ctx);
  }
}
