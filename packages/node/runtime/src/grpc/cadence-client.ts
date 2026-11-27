import type { CadenceRunMode, CadenceRunResult, QuotaStatus } from '@aklapper/core';
import { createClient } from '@connectrpc/connect';

import { logCadencePayloadViolation, mapProtoCadenceRunToDomain } from './cadence-mappers.ts';
import { GrpcPayloadContractError, mapProtoQuotaToDomain } from './errors.ts';
import { CadenceService, type StreamRunResponse } from './gen/cadence/v1/cadence_pb.ts';
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
    throw new GrpcPayloadContractError(
      'CreateRunResponse',
      'CadenceService.CreateRun returned empty run',
    );
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
    throw new GrpcPayloadContractError(
      'ApproveSpecGateResponse',
      'CadenceService.ApproveSpecGate returned empty run',
    );
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
    throw new GrpcPayloadContractError(
      'SubmitGateVerdictResponse',
      'CadenceService.SubmitGateVerdict returned empty run',
    );
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
