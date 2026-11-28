import {
  AdminQuotasLoaderDataSchema,
  AdminSandboxRunSchema,
  QdrantHealthStatusSchema,
  QuotaPolicyRecordSchema,
  type AdminQuotasLoaderData,
  type AdminSandboxRun,
  type CadenceGateVerdict,
  type QdrantHealthStatus,
  type QuotaPolicyRecord,
  type QuotaPolicyUpdate,
} from '@aklapper/core';
import { create } from '@bufbuild/protobuf';
import { createClient } from '@connectrpc/connect';

import {
  buildAdminGrpcCallMeta,
  rethrowAdminGrpcError,
  type AdminGrpcCallContext,
} from './admin-common.ts';
import { mapProtoCadenceTurnToDomain } from './cadence-mappers.ts';
import { GrpcPayloadContractError } from './errors.ts';
import {
  AdminOpsService,
  GetQdrantStatusRequestSchema,
  ListSandboxRunsRequestSchema,
  OverrideSandboxGateVerdictRequestSchema,
  type AdminSandboxRun as ProtoAdminSandboxRun,
} from './gen/admin/v1/ops_pb.ts';
import {
  AdminQuotasService,
  ListQuotasAndBucketsRequestSchema,
  PurgeStaleRateLimitBucketsRequestSchema,
  ResetRateLimitBucketRequestSchema,
  UpdateQuotaPolicyRequestSchema,
} from './gen/admin/v1/quotas_pb.ts';
import { getOrCreateGoGrpcTransport, invokeUnaryWithAuth } from './transport.ts';

function createQuotasClient(sessionId: string, ctx: AdminGrpcCallContext = {}) {
  const meta = buildAdminGrpcCallMeta({ ...ctx, sessionId, role: 'admin' });
  return {
    client: createClient(AdminQuotasService, getOrCreateGoGrpcTransport(meta.baseUrl)),
    meta,
  };
}

function createOpsClient(sessionId: string, ctx: AdminGrpcCallContext = {}) {
  const meta = buildAdminGrpcCallMeta({ ...ctx, sessionId, role: 'admin' });
  return {
    client: createClient(AdminOpsService, getOrCreateGoGrpcTransport(meta.baseUrl)),
    meta,
  };
}

function mapProtoAdminSandboxRun(proto: ProtoAdminSandboxRun): AdminSandboxRun {
  return AdminSandboxRunSchema.parse({
    runId: proto.runId,
    sessionId: proto.sessionId,
    menuSlug: proto.menuSlug,
    runStatus: proto.runStatus,
    prompt: proto.prompt,
    gateVerdict: proto.gateVerdict,
    turns: proto.turns.map(mapProtoCadenceTurnToDomain),
    artifactHtml: proto.artifactHtml,
    tokensIn: proto.tokensIn,
    tokensOut: proto.tokensOut,
    createdAt: proto.createdAt,
  });
}

export async function listAdminQuotasAndBucketsViaGrpc(
  sessionId: string,
  ctx: AdminGrpcCallContext = {},
): Promise<AdminQuotasLoaderData> {
  const { client, meta } = createQuotasClient(sessionId, ctx);
  try {
    const res = await invokeUnaryWithAuth(
      '/admin.v1.AdminQuotasService/ListQuotasAndBuckets',
      meta,
      opts => client.listQuotasAndBuckets(create(ListQuotasAndBucketsRequestSchema, {}), opts),
    );
    return AdminQuotasLoaderDataSchema.parse({
      policies: res.policies.map(p => ({
        role: p.role,
        maxTurnsPerSession: p.maxTurnsPerSession,
        maxTokensPerRun: p.maxTokensPerRun,
        maxDailyGlobalTokens: p.maxDailyGlobalTokens,
      })),
      buckets: res.buckets.map(b => ({
        scopeKey: b.scopeKey,
        windowStart: b.windowStart,
        turnsUsed: b.turnsUsed,
        tokensUsed: b.tokensUsed,
      })),
    });
  } catch (error) {
    rethrowAdminGrpcError(error, 'admin.quotas.list', ctx);
  }
}

export async function updateAdminQuotaPolicyViaGrpc(
  sessionId: string,
  input: QuotaPolicyUpdate,
  ctx: AdminGrpcCallContext = {},
): Promise<QuotaPolicyRecord> {
  const { client, meta } = createQuotasClient(sessionId, ctx);
  try {
    const res = await invokeUnaryWithAuth(
      '/admin.v1.AdminQuotasService/UpdateQuotaPolicy',
      meta,
      opts => client.updateQuotaPolicy(create(UpdateQuotaPolicyRequestSchema, input), opts),
    );
    if (!res.policy) throw new GrpcPayloadContractError('QuotaPolicyRecord');
    return QuotaPolicyRecordSchema.parse({
      role: res.policy.role,
      maxTurnsPerSession: res.policy.maxTurnsPerSession,
      maxTokensPerRun: res.policy.maxTokensPerRun,
      maxDailyGlobalTokens: res.policy.maxDailyGlobalTokens,
    });
  } catch (error) {
    rethrowAdminGrpcError(error, 'admin.quotas.update', ctx);
  }
}

export async function resetAdminRateLimitBucketViaGrpc(
  sessionId: string,
  scopeKey: string,
  ctx: AdminGrpcCallContext = {},
): Promise<boolean> {
  const { client, meta } = createQuotasClient(sessionId, ctx);
  try {
    const res = await invokeUnaryWithAuth(
      '/admin.v1.AdminQuotasService/ResetRateLimitBucket',
      meta,
      opts =>
        client.resetRateLimitBucket(create(ResetRateLimitBucketRequestSchema, { scopeKey }), opts),
    );
    return res.reset;
  } catch (error) {
    rethrowAdminGrpcError(error, 'admin.quotas.reset', ctx);
  }
}

export async function purgeAdminStaleRateLimitBucketsViaGrpc(
  sessionId: string,
  olderThanHours = 24,
  ctx: AdminGrpcCallContext = {},
): Promise<number> {
  const { client, meta } = createQuotasClient(sessionId, ctx);
  try {
    const res = await invokeUnaryWithAuth(
      '/admin.v1.AdminQuotasService/PurgeStaleRateLimitBuckets',
      meta,
      opts =>
        client.purgeStaleRateLimitBuckets(
          create(PurgeStaleRateLimitBucketsRequestSchema, { olderThanHours }),
          opts,
        ),
    );
    return res.purgedCount;
  } catch (error) {
    rethrowAdminGrpcError(error, 'admin.quotas.purge', ctx);
  }
}

export async function listAdminSandboxRunsViaGrpc(
  sessionId: string,
  limit = 25,
  ctx: AdminGrpcCallContext = {},
): Promise<AdminSandboxRun[]> {
  const { client, meta } = createOpsClient(sessionId, ctx);
  try {
    const res = await invokeUnaryWithAuth('/admin.v1.AdminOpsService/ListSandboxRuns', meta, opts =>
      client.listSandboxRuns(create(ListSandboxRunsRequestSchema, { limit }), opts),
    );
    return res.runs.map(mapProtoAdminSandboxRun);
  } catch (error) {
    rethrowAdminGrpcError(error, 'admin.ops.sandbox_list', ctx);
  }
}

export async function overrideAdminSandboxGateVerdictViaGrpc(
  sessionId: string,
  runId: string,
  gateVerdict: CadenceGateVerdict,
  ctx: AdminGrpcCallContext = {},
): Promise<AdminSandboxRun> {
  const { client, meta } = createOpsClient(sessionId, ctx);
  try {
    const res = await invokeUnaryWithAuth(
      '/admin.v1.AdminOpsService/OverrideSandboxGateVerdict',
      meta,
      opts =>
        client.overrideSandboxGateVerdict(
          create(OverrideSandboxGateVerdictRequestSchema, { runId, gateVerdict }),
          opts,
        ),
    );
    if (!res.run) throw new GrpcPayloadContractError('AdminSandboxRun');
    return mapProtoAdminSandboxRun(res.run);
  } catch (error) {
    rethrowAdminGrpcError(error, 'admin.ops.sandbox_override', ctx);
  }
}

export async function getAdminQdrantStatusViaGrpc(
  sessionId: string,
  ctx: AdminGrpcCallContext = {},
): Promise<QdrantHealthStatus> {
  const { client, meta } = createOpsClient(sessionId, ctx);
  try {
    const res = await invokeUnaryWithAuth('/admin.v1.AdminOpsService/GetQdrantStatus', meta, opts =>
      client.getQdrantStatus(create(GetQdrantStatusRequestSchema, {}), opts),
    );
    return QdrantHealthStatusSchema.parse({
      online: res.online,
      collection: res.collection || 'portfolio_docs',
      status: res.status || 'offline',
      pointsCount: res.pointsCount,
      provider: res.provider || 'unconfigured',
      ...(res.detail !== undefined ? { detail: res.detail } : {}),
      collections: res.collections.map(c => ({
        name: c.name,
        online: c.online,
        status: c.status,
        pointsCount: c.pointsCount,
      })),
    });
  } catch (error) {
    rethrowAdminGrpcError(error, 'admin.ops.qdrant_status', ctx);
  }
}
