import {
  CadenceRunResultSchema,
  CadenceStreamCompleteEventSchema,
  CadenceStreamErrorEventSchema,
  CadenceStreamLogEventSchema,
  CadenceStreamPhaseEventSchema,
  type CadenceGateAudit,
  type CadenceRunMode,
  type CadenceRunResult,
  type CadenceSpecArtifact,
  type CadenceTurn,
  type CadenceTurnPayloadValue,
  type Osc7501Status,
  type QuotaStatus,
} from '@aklapper/core';
import { createClient } from '@connectrpc/connect';

import type { SsrStructuredLogger } from '../request-context.ts';
import { mapProtoQuotaToDomain } from './errors.ts';
import {
  CadenceService,
  type CadenceGateAudit as ProtoGateAudit,
  type CadenceRunResult as ProtoCadenceRunResult,
  type CadenceSpecArtifact as ProtoSpecArtifact,
  type CadenceTurn as ProtoCadenceTurn,
  type CadenceTurnPayloadValue as ProtoPayloadValue,
  type Osc7501Status as ProtoOsc7501Status,
  type StreamRunResponse,
} from './gen/cadence/v1/cadence_pb.ts';
import type { MappedSseFrame } from './sse-bridge.ts';
import {
  getOrCreateGoGrpcTransport,
  invokeUnaryWithAuth,
  openServerStreamWithAuth,
  type GrpcCallMetadata,
} from './transport.ts';

export interface CreateCadenceRunInput {
  readonly prompt: string;
  readonly presetSlug?: string;
  readonly mode?: CadenceRunMode;
  readonly deferExecution?: boolean;
  readonly requireSpecApproval?: boolean;
}

export interface CreateCadenceRunResult {
  readonly run: CadenceRunResult;
  readonly createdImmediately: boolean;
}

export interface ListCadenceRunsInput {
  readonly sessionId?: string;
  readonly limit?: number;
}

export interface ListCadenceRunsResult {
  readonly runs: readonly CadenceRunResult[];
  readonly quota?: QuotaStatus;
}

export interface ApproveSpecGateResult {
  readonly run: CadenceRunResult;
  readonly quota?: QuotaStatus;
}

export interface SubmitGateVerdictResult {
  readonly run: CadenceRunResult;
}

function nonEmpty(raw: string | undefined): string | undefined {
  return raw && raw.length > 0 ? raw : undefined;
}

function logCadencePayloadViolation(
  logger: SsrStructuredLogger | undefined,
  schemaName: string,
  runId?: string,
): void {
  const entry = {
    seam_type: 'BOUNDARY_FAULT',
    event: 'bff.grpc.payload_contract_violation',
    schema: schemaName,
    ...(runId ? { runId } : {}),
  };
  if (logger) {
    logger.error(entry, 'Mapped gRPC CadenceService payload failed core schema validation');
  } else {
    console.error(JSON.stringify(entry));
  }
}

export function mapProtoPayloadValueToDomain(val: ProtoPayloadValue): CadenceTurnPayloadValue {
  switch (val.kind.case) {
    case 'stringValue':
      return val.kind.value;
    case 'numberValue':
      return val.kind.value;
    case 'boolValue':
      return val.kind.value;
    case 'nullValue':
      return null;
    case 'stringListValue':
      return [...val.kind.value.values];
    default:
      return null;
  }
}

function mapProtoOscStatus(proto?: ProtoOsc7501Status): Osc7501Status | undefined {
  if (!proto || !nonEmpty(proto.source) || !nonEmpty(proto.state) || !nonEmpty(proto.label)) {
    return undefined;
  }
  return {
    source: proto.source,
    state: proto.state as Osc7501Status['state'],
    label: proto.label,
    ...(typeof proto.progress === 'number' ? { progress: proto.progress } : {}),
    timestamp: nonEmpty(proto.timestamp) ?? new Date().toISOString(),
  };
}

function mapProtoSpec(proto?: ProtoSpecArtifact): CadenceSpecArtifact | undefined {
  if (!proto || !nonEmpty(proto.title) || !nonEmpty(proto.summary)) {
    return undefined;
  }
  return {
    title: proto.title,
    summary: proto.summary,
    conditions: [...proto.conditions],
    handling: [...proto.handling],
    outcomes: [...proto.outcomes],
    rules: [...proto.rules],
    deltas: [...proto.deltas],
    ...(proto.recalledPatterns.length > 0 ? { recalledPatterns: [...proto.recalledPatterns] } : {}),
  };
}

function mapProtoGateAudit(proto?: ProtoGateAudit): CadenceGateAudit | undefined {
  if (!proto || !nonEmpty(proto.summary)) {
    return undefined;
  }
  return {
    summary: proto.summary,
    sanitized: proto.sanitized,
    artifactBytes: proto.artifactBytes,
    checks: proto.checks.map(c => ({
      id: c.id,
      label: c.label,
      status: c.status as CadenceGateAudit['checks'][number]['status'],
      detail: c.detail,
    })),
  };
}

export function mapProtoCadenceTurnToDomain(proto: ProtoCadenceTurn): CadenceTurn {
  const payloadEntries = Object.entries(proto.payload);
  let payload: Record<string, CadenceTurnPayloadValue> | undefined;
  if (payloadEntries.length > 0) {
    payload = {};
    for (const [k, v] of payloadEntries) {
      payload[k] = mapProtoPayloadValueToDomain(v);
    }
  }
  return {
    ...(typeof proto.id === 'number' && proto.id > 0 ? { id: proto.id } : {}),
    phase: proto.phase as CadenceTurn['phase'],
    agentName: proto.agentName,
    status: proto.status as CadenceTurn['status'],
    summary: proto.summary,
    latencyMs: proto.latencyMs,
    ...(payload ? { payload } : {}),
    ...(nonEmpty(proto.createdAt) ? { createdAt: proto.createdAt } : {}),
  };
}

export function mapProtoCadenceRunToDomain(
  proto: ProtoCadenceRunResult,
  logger?: SsrStructuredLogger,
): CadenceRunResult {
  const spec = mapProtoSpec(proto.spec);
  const gateAudit = mapProtoGateAudit(proto.gateAudit);
  const status = mapProtoOscStatus(proto.status);
  const quota = mapProtoQuotaToDomain(proto.quota);

  const candidate = {
    runId: proto.runId,
    prompt: proto.prompt,
    ...(nonEmpty(proto.presetSlug) ? { presetSlug: proto.presetSlug } : {}),
    ...(nonEmpty(proto.runStatus) ? { runStatus: proto.runStatus } : {}),
    ...(nonEmpty(proto.mode) ? { mode: proto.mode } : {}),
    ...(nonEmpty(proto.executionMode) ? { executionMode: proto.executionMode } : {}),
    isGolden: proto.isGolden,
    ...(spec ? { spec } : {}),
    ...(gateAudit ? { gateAudit } : {}),
    ...(status ? { status } : {}),
    ...(nonEmpty(proto.osc7501) ? { osc7501: proto.osc7501 } : {}),
    gateVerdict: proto.gateVerdict,
    turns: proto.turns.map(mapProtoCadenceTurnToDomain),
    artifactHtml: proto.artifactHtml,
    ...(typeof proto.tokensIn === 'number' ? { tokensIn: proto.tokensIn } : {}),
    ...(typeof proto.tokensOut === 'number' ? { tokensOut: proto.tokensOut } : {}),
    ...(quota ? { quota } : {}),
    ...(nonEmpty(proto.createdAt) ? { createdAt: proto.createdAt } : {}),
  };

  const parsed = CadenceRunResultSchema.safeParse(candidate);
  if (!parsed.success) {
    logCadencePayloadViolation(logger, 'CadenceRunResultSchema', nonEmpty(proto.runId));
    throw parsed.error;
  }
  return parsed.data;
}

export function mapProtoCadenceChunkToSse(
  chunk: StreamRunResponse,
  logger?: SsrStructuredLogger,
): MappedSseFrame | null {
  const payload = chunk.payload;
  switch (payload.case) {
    case 'phase': {
      const v = payload.value;
      if (!v.turn) {
        logCadencePayloadViolation(logger, 'CadenceStreamPhaseEventSchema', nonEmpty(v.runId));
        return null;
      }
      const status = mapProtoOscStatus(v.status);
      const spec = mapProtoSpec(v.spec);
      const candidate = {
        runId: v.runId,
        runStatus: v.runStatus,
        ...(status ? { status } : {}),
        ...(typeof v.progress === 'number' ? { progress: v.progress } : {}),
        turn: mapProtoCadenceTurnToDomain(v.turn),
        ...(spec ? { spec } : {}),
      };
      const parsed = CadenceStreamPhaseEventSchema.safeParse(candidate);
      if (!parsed.success) {
        logCadencePayloadViolation(logger, 'CadenceStreamPhaseEventSchema', nonEmpty(v.runId));
        return null;
      }
      return { event: 'phase', data: parsed.data };
    }
    case 'log': {
      const v = payload.value;
      const candidate = {
        runId: v.runId,
        line: v.line,
        ...(nonEmpty(v.timestamp) ? { timestamp: v.timestamp } : {}),
      };
      const parsed = CadenceStreamLogEventSchema.safeParse(candidate);
      if (!parsed.success) {
        logCadencePayloadViolation(logger, 'CadenceStreamLogEventSchema', nonEmpty(v.runId));
        return null;
      }
      return { event: 'log', data: parsed.data };
    }
    case 'complete': {
      const v = payload.value;
      if (!v.run) {
        logCadencePayloadViolation(logger, 'CadenceStreamCompleteEventSchema');
        return null;
      }
      const run = mapProtoCadenceRunToDomain(v.run, logger);
      const quota = mapProtoQuotaToDomain(v.quota);
      const parsed = CadenceStreamCompleteEventSchema.safeParse({
        run,
        ...(quota ? { quota } : {}),
      });
      if (!parsed.success) {
        logCadencePayloadViolation(logger, 'CadenceStreamCompleteEventSchema', run.runId);
        return null;
      }
      return { event: 'complete', data: parsed.data };
    }
    case 'error': {
      const v = payload.value;
      const candidate = {
        runId: v.runId,
        error: v.error,
        ...(nonEmpty(v.code) ? { code: v.code } : {}),
        ...(nonEmpty(v.runStatus) ? { runStatus: v.runStatus } : {}),
      };
      const parsed = CadenceStreamErrorEventSchema.safeParse(candidate);
      if (!parsed.success) {
        logCadencePayloadViolation(logger, 'CadenceStreamErrorEventSchema', nonEmpty(v.runId));
        return null;
      }
      return { event: 'error', data: parsed.data };
    }
    default:
      return null;
  }
}

function createCadenceServiceClient(meta: GrpcCallMetadata) {
  const transport = meta.transport ?? getOrCreateGoGrpcTransport(meta.baseUrl);
  return createClient(CadenceService, transport);
}

export async function createCadenceRun(
  meta: GrpcCallMetadata,
  req: CreateCadenceRunInput,
): Promise<CreateCadenceRunResult> {
  const client = createCadenceServiceClient(meta);
  const res = await invokeUnaryWithAuth('/cadence.v1.CadenceService/CreateRun', meta, opts =>
    client.createRun(
      {
        prompt: req.prompt,
        presetSlug: req.presetSlug ?? '',
        mode: req.mode ?? '',
        deferExecution: req.deferExecution ?? false,
        requireSpecApproval: req.requireSpecApproval ?? false,
      },
      opts,
    ),
  );
  if (!res.run) {
    logCadencePayloadViolation(meta.logger, 'CreateRunResponse');
    throw new Error('CadenceService.CreateRun returned empty run');
  }
  return {
    run: mapProtoCadenceRunToDomain(res.run, meta.logger),
    createdImmediately: res.createdImmediately,
  };
}

export async function listCadenceRuns(
  meta: GrpcCallMetadata,
  req: ListCadenceRunsInput = {},
): Promise<ListCadenceRunsResult> {
  const client = createCadenceServiceClient(meta);
  const res = await invokeUnaryWithAuth('/cadence.v1.CadenceService/ListRuns', meta, opts =>
    client.listRuns(
      {
        sessionId: req.sessionId ?? '',
        limit: req.limit ?? 10,
      },
      opts,
    ),
  );
  const quota = mapProtoQuotaToDomain(res.quota);
  return {
    runs: res.runs.map(r => mapProtoCadenceRunToDomain(r, meta.logger)),
    ...(quota ? { quota } : {}),
  };
}

export async function approveCadenceSpecGate(
  meta: GrpcCallMetadata,
  runId: string,
): Promise<ApproveSpecGateResult> {
  const client = createCadenceServiceClient(meta);
  const res = await invokeUnaryWithAuth('/cadence.v1.CadenceService/ApproveSpecGate', meta, opts =>
    client.approveSpecGate({ runId }, opts),
  );
  if (!res.run) {
    logCadencePayloadViolation(meta.logger, 'ApproveSpecGateResponse', runId);
    throw new Error('CadenceService.ApproveSpecGate returned empty run');
  }
  const quota = mapProtoQuotaToDomain(res.quota);
  return {
    run: mapProtoCadenceRunToDomain(res.run, meta.logger),
    ...(quota ? { quota } : {}),
  };
}

export async function submitCadenceGateVerdict(
  meta: GrpcCallMetadata,
  runId: string,
  verdict: 'approved' | 'rejected',
): Promise<SubmitGateVerdictResult> {
  const client = createCadenceServiceClient(meta);
  const res = await invokeUnaryWithAuth(
    '/cadence.v1.CadenceService/SubmitGateVerdict',
    meta,
    opts => client.submitGateVerdict({ runId, verdict }, opts),
  );
  if (!res.run) {
    logCadencePayloadViolation(meta.logger, 'SubmitGateVerdictResponse', runId);
    throw new Error('CadenceService.SubmitGateVerdict returned empty run');
  }
  return {
    run: mapProtoCadenceRunToDomain(res.run, meta.logger),
  };
}

export function streamCadenceRun(
  meta: GrpcCallMetadata,
  runId: string,
  callbacks?: { readonly onHeader?: (headers: Headers) => void },
): AsyncIterable<StreamRunResponse> {
  const client = createCadenceServiceClient(meta);
  return openServerStreamWithAuth(
    '/cadence.v1.CadenceService/StreamRun',
    meta,
    opts => client.streamRun({ runId }, opts),
    callbacks?.onHeader,
  );
}
