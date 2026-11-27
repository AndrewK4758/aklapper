import type { CareerDossier, CareerDossierUpsertInput } from '@aklapper/core';
import { create } from '@bufbuild/protobuf';
import { createClient } from '@connectrpc/connect';

import { toProtoCareerDossierInput } from './admin-cms-mappers.ts';
import {
  buildAdminGrpcCallMeta,
  rethrowAdminGrpcError,
  type AdminGrpcCallContext,
} from './admin-common.ts';
import { GrpcPayloadContractError } from './errors.ts';
import {
  AdminCmsService,
  DeleteCareerDossierRequestSchema,
  ImportCareerDossiersBatchRequestSchema,
  ListCareerDossiersRequestSchema,
  PublishCareerDossierRequestSchema,
  UnpublishCareerDossierRequestSchema,
  UpsertCareerDossierRequestSchema,
} from './gen/admin/v1/cms_pb.ts';
import { mapProtoCareerDossierToDomain } from './portal-mappers.ts';
import { getOrCreateGoGrpcTransport, invokeUnaryWithAuth } from './transport.ts';

function createDossiersClient(sessionId: string, ctx: AdminGrpcCallContext = {}) {
  const meta = buildAdminGrpcCallMeta({ ...ctx, sessionId, role: 'admin' });
  return {
    client: createClient(AdminCmsService, getOrCreateGoGrpcTransport(meta.baseUrl)),
    meta,
  };
}

export async function listAdminCareerDossiersViaGrpc(
  sessionId: string,
  ctx: AdminGrpcCallContext = {},
): Promise<CareerDossier[]> {
  const { client, meta } = createDossiersClient(sessionId, ctx);
  try {
    const res = await invokeUnaryWithAuth(
      '/admin.v1.AdminCmsService/ListCareerDossiers',
      meta,
      opts => client.listCareerDossiers(create(ListCareerDossiersRequestSchema, {}), opts),
    );
    return res.dossiers.map(d => mapProtoCareerDossierToDomain(d));
  } catch (error) {
    rethrowAdminGrpcError(error, 'admin.cms.dossiers_list', ctx);
  }
}

export async function upsertAdminCareerDossierViaGrpc(
  sessionId: string,
  input: CareerDossierUpsertInput,
  ctx: AdminGrpcCallContext = {},
): Promise<CareerDossier> {
  const { client, meta } = createDossiersClient(sessionId, ctx);
  try {
    const res = await invokeUnaryWithAuth(
      '/admin.v1.AdminCmsService/UpsertCareerDossier',
      meta,
      opts =>
        client.upsertCareerDossier(
          create(UpsertCareerDossierRequestSchema, {
            dossier: toProtoCareerDossierInput(input),
          }),
          opts,
        ),
    );
    if (!res.dossier) throw new GrpcPayloadContractError('CareerDossier');
    return mapProtoCareerDossierToDomain(res.dossier);
  } catch (error) {
    rethrowAdminGrpcError(error, 'admin.cms.dossier_upsert', ctx);
  }
}

export async function publishAdminCareerDossierViaGrpc(
  sessionId: string,
  slug: string,
  ctx: AdminGrpcCallContext = {},
): Promise<CareerDossier> {
  const { client, meta } = createDossiersClient(sessionId, ctx);
  try {
    const res = await invokeUnaryWithAuth(
      '/admin.v1.AdminCmsService/PublishCareerDossier',
      meta,
      opts =>
        client.publishCareerDossier(create(PublishCareerDossierRequestSchema, { slug }), opts),
    );
    if (!res.dossier) throw new GrpcPayloadContractError('CareerDossier');
    return mapProtoCareerDossierToDomain(res.dossier);
  } catch (error) {
    rethrowAdminGrpcError(error, 'admin.cms.dossier_publish', ctx);
  }
}

export async function unpublishAdminCareerDossierViaGrpc(
  sessionId: string,
  slug: string,
  ctx: AdminGrpcCallContext = {},
): Promise<CareerDossier> {
  const { client, meta } = createDossiersClient(sessionId, ctx);
  try {
    const res = await invokeUnaryWithAuth(
      '/admin.v1.AdminCmsService/UnpublishCareerDossier',
      meta,
      opts =>
        client.unpublishCareerDossier(create(UnpublishCareerDossierRequestSchema, { slug }), opts),
    );
    if (!res.dossier) throw new GrpcPayloadContractError('CareerDossier');
    return mapProtoCareerDossierToDomain(res.dossier);
  } catch (error) {
    rethrowAdminGrpcError(error, 'admin.cms.dossier_unpublish', ctx);
  }
}

export async function deleteAdminCareerDossierViaGrpc(
  sessionId: string,
  slug: string,
  ctx: AdminGrpcCallContext = {},
): Promise<boolean> {
  const { client, meta } = createDossiersClient(sessionId, ctx);
  try {
    const res = await invokeUnaryWithAuth(
      '/admin.v1.AdminCmsService/DeleteCareerDossier',
      meta,
      opts => client.deleteCareerDossier(create(DeleteCareerDossierRequestSchema, { slug }), opts),
    );
    return res.deleted;
  } catch (error) {
    rethrowAdminGrpcError(error, 'admin.cms.dossier_delete', ctx);
  }
}

export async function importAdminCareerDossiersBatchViaGrpc(
  sessionId: string,
  dossiers: readonly CareerDossierUpsertInput[],
  ctx: AdminGrpcCallContext = {},
): Promise<CareerDossier[]> {
  const { client, meta } = createDossiersClient(sessionId, ctx);
  try {
    const res = await invokeUnaryWithAuth(
      '/admin.v1.AdminCmsService/ImportCareerDossiersBatch',
      meta,
      opts =>
        client.importCareerDossiersBatch(
          create(ImportCareerDossiersBatchRequestSchema, {
            dossiers: dossiers.map(toProtoCareerDossierInput),
          }),
          opts,
        ),
    );
    return res.dossiers.map(d => mapProtoCareerDossierToDomain(d));
  } catch (error) {
    rethrowAdminGrpcError(error, 'admin.cms.dossier_import', ctx);
  }
}
