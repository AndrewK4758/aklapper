import type { AskResponse, AskTurnState } from '@aklapper/core';
import { createClient } from '@connectrpc/connect';

import {
  logAskPayloadViolation,
  mapProtoAskResponseToDomain,
  mapProtoAskTurnStateToDomain,
} from './ask-mappers.ts';
import { GrpcPayloadContractError } from './errors.ts';
import { AskService, type AskStreamChunk } from './gen/ai_ask/v1/ask_pb.ts';
import {
  getOrCreateGoGrpcTransport,
  invokeUnaryWithAuth,
  openServerStreamWithAuth,
  type GrpcCallMetadata,
} from './transport.ts';

export interface CallAskInput {
  readonly mode: 'qa' | 'jd_match';
  readonly question?: string;
  readonly jobDescription?: string;
  readonly attemptId?: string;
  readonly conversationId?: string;
  readonly visitorLens?: string;
}

export type CallAskResult =
  | { readonly kind: 'completed'; readonly response: AskResponse }
  | { readonly kind: 'pending'; readonly turn: AskTurnState };

export interface StreamAskInput {
  readonly mode?: 'qa';
  readonly question: string;
  readonly attemptId?: string;
  readonly conversationId?: string;
  readonly visitorLens?: string;
}

export interface AskUpstreamStatusResult {
  readonly status: 'ready' | 'degraded';
  readonly provider: string;
  readonly pgConnected: boolean;
  readonly collection?: {
    readonly name: string;
    readonly status: string;
    readonly pointsCount: number;
    readonly vectorSize?: number;
  };
}

export interface ReindexResult {
  readonly indexed: number;
  readonly pruned: number;
  readonly collection: string;
  readonly vectorSize: number;
  readonly provider: string;
  readonly correlationId: string;
}

function createAskServiceClient(meta: GrpcCallMetadata) {
  const transport = meta.transport ?? getOrCreateGoGrpcTransport(meta.baseUrl);
  return createClient(AskService, transport);
}

export async function callAsk(meta: GrpcCallMetadata, req: CallAskInput): Promise<CallAskResult> {
  const client = createAskServiceClient(meta);
  const res = await invokeUnaryWithAuth('/ai_ask.v1.AskService/Ask', meta, opts =>
    client.ask(
      {
        mode: req.mode,
        question: req.question ?? '',
        jobDescription: req.jobDescription ?? '',
        attemptId: req.attemptId ?? '',
        conversationId: req.conversationId ?? '',
        visitorLens: req.visitorLens ?? '',
      },
      opts,
    ),
  );
  if (res.outcome.case === 'completed') {
    return {
      kind: 'completed',
      response: mapProtoAskResponseToDomain(res.outcome.value, meta.logger),
    };
  }
  if (res.outcome.case === 'pending') {
    return {
      kind: 'pending',
      turn: mapProtoAskTurnStateToDomain(res.outcome.value, meta.logger),
    };
  }
  logAskPayloadViolation(meta.logger, 'AskUnaryResponse', meta.correlationId);
  throw new GrpcPayloadContractError(
    'AskUnaryResponse',
    'AskService.Ask returned empty outcome oneof',
  );
}

export function streamAsk(
  meta: GrpcCallMetadata,
  req: StreamAskInput,
  callbacks?: { readonly onHeader?: (headers: Headers) => void },
): AsyncIterable<AskStreamChunk> {
  const client = createAskServiceClient(meta);
  return openServerStreamWithAuth(
    '/ai_ask.v1.AskService/StreamAsk',
    meta,
    opts =>
      client.streamAsk(
        {
          mode: req.mode ?? 'qa',
          question: req.question,
          jobDescription: '',
          attemptId: req.attemptId ?? '',
          conversationId: req.conversationId ?? '',
          visitorLens: req.visitorLens ?? '',
        },
        opts,
      ),
    callbacks?.onHeader,
  );
}

export async function getAskStatus(meta: GrpcCallMetadata): Promise<AskUpstreamStatusResult> {
  const client = createAskServiceClient(meta);
  const res = await invokeUnaryWithAuth('/ai_ask.v1.AskService/GetAskStatus', meta, opts =>
    client.getAskStatus({}, opts),
  );
  return {
    status: res.status === 'ready' ? 'ready' : 'degraded',
    provider: res.provider || 'unknown',
    pgConnected: res.pgConnected,
    ...(res.collection
      ? {
          collection: {
            name: res.collection.name,
            status: res.collection.status,
            pointsCount: res.collection.pointsCount,
            ...(res.collection.vectorSize > 0 ? { vectorSize: res.collection.vectorSize } : {}),
          },
        }
      : {}),
  };
}

export async function getAskTurn(meta: GrpcCallMetadata, attemptId: string): Promise<AskTurnState> {
  const client = createAskServiceClient(meta);
  const res = await invokeUnaryWithAuth('/ai_ask.v1.AskService/GetTurn', meta, opts =>
    client.getTurn({ attemptId }, opts),
  );
  return mapProtoAskTurnStateToDomain(res, meta.logger);
}

export async function triggerReindex(meta: GrpcCallMetadata): Promise<ReindexResult> {
  const client = createAskServiceClient(meta);
  const res = await invokeUnaryWithAuth('/ai_ask.v1.AskService/Reindex', meta, opts =>
    client.reindex({}, opts),
  );
  return {
    indexed: res.indexed,
    pruned: res.pruned,
    collection: res.collection,
    vectorSize: res.vectorSize,
    provider: res.provider,
    correlationId: res.correlationId || meta.correlationId,
  };
}
