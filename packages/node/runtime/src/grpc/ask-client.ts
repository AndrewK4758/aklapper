import {
  AskResponseSchema,
  AskSourceSchema,
  AskStreamEventSchema,
  AskTurnStateSchema,
  PublicAppErrorSchema,
  type AskResponse,
  type AskSource,
  type AskTurnState,
  type PublicAppError,
} from '@aklapper/core';
import { createClient } from '@connectrpc/connect';

import type { SsrStructuredLogger } from '../request-context.ts';
import { mapProtoQuotaToDomain } from './errors.ts';
import {
  AskService,
  type AskResponse as ProtoAskResponse,
  type AskSource as ProtoAskSource,
  type AskStreamChunk,
  type AskTurnState as ProtoAskTurnState,
  type GetTurnResponse,
} from './gen/ai_ask/v1/ask_pb.ts';
import type { PublicAppError as ProtoPublicAppError } from './gen/common/v1/error_pb.ts';
import type { MappedSseFrame } from './sse-bridge.ts';
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

function nonEmpty(raw: string | undefined): string | undefined {
  return raw && raw.length > 0 ? raw : undefined;
}

function logPayloadViolation(
  logger: SsrStructuredLogger | undefined,
  schemaName: string,
  correlationId: string | undefined,
): void {
  const entry = {
    seam_type: 'BOUNDARY_FAULT',
    event: 'bff.grpc.payload_contract_violation',
    schema: schemaName,
    ...(correlationId ? { correlationId } : {}),
  };
  if (logger) {
    logger.error(entry, 'Mapped gRPC AskService payload failed core schema validation');
  } else {
    console.error(JSON.stringify(entry));
  }
}

export function mapProtoPublicErrorToDomain(
  proto?: ProtoPublicAppError,
): PublicAppError | undefined {
  if (!proto) return undefined;
  const parsed = PublicAppErrorSchema.safeParse({
    code: proto.code,
    status: proto.status,
    message: proto.message,
    action: proto.action,
    correlationId: proto.correlationId,
  });
  return parsed.success ? (parsed.data as PublicAppError) : undefined;
}

export function mapProtoAskSourceToDomain(src: ProtoAskSource): AskSource {
  const candidate = {
    ...(nonEmpty(src.id) ? { id: src.id } : {}),
    title: src.title,
    snippet: src.snippet,
    score: src.score,
    ...(nonEmpty(src.category) ? { category: src.category } : {}),
    ...(nonEmpty(src.sectionHeading) ? { sectionHeading: src.sectionHeading } : {}),
    ...(nonEmpty(src.docKey) ? { docKey: src.docKey } : {}),
  };
  return AskSourceSchema.parse(candidate);
}

export function mapProtoAskResponseToDomain(
  proto: ProtoAskResponse,
  logger?: SsrStructuredLogger,
): AskResponse {
  const quota = mapProtoQuotaToDomain(proto.quota);
  const candidate = {
    ...(nonEmpty(proto.attemptId) ? { attemptId: proto.attemptId } : {}),
    grounded: proto.grounded,
    abstained: proto.abstained,
    ...(nonEmpty(proto.groundingTier) ? { groundingTier: proto.groundingTier } : {}),
    ...(nonEmpty(proto.conversationId) ? { conversationId: proto.conversationId } : {}),
    ...(typeof proto.turnIndex === 'number' && proto.turnIndex > 0
      ? { turnIndex: proto.turnIndex }
      : {}),
    mode: proto.mode,
    answer: proto.answer,
    sources: proto.sources.map(mapProtoAskSourceToDomain),
    ...(proto.suggestedLinks.length > 0
      ? {
          suggestedLinks: proto.suggestedLinks.map(l => ({
            route: l.route,
            label: l.label,
            reason: l.reason,
          })),
        }
      : {}),
    ...(proto.followUpQuestions.length > 0 ? { followUpQuestions: proto.followUpQuestions } : {}),
    ...(typeof proto.matchScore === 'number' ? { matchScore: proto.matchScore } : {}),
    ...(proto.strengths.length > 0 ? { strengths: proto.strengths } : {}),
    ...(proto.gaps.length > 0 ? { gaps: proto.gaps } : {}),
    provider: proto.provider,
    ...(nonEmpty(proto.model) ? { model: proto.model } : {}),
    tokensUsed: proto.tokensUsed,
    ...(typeof proto.latencyMs === 'number' ? { latencyMs: proto.latencyMs } : {}),
    ...(nonEmpty(proto.correlationId) ? { correlationId: proto.correlationId } : {}),
    ...(quota ? { quota } : {}),
  };
  const parsed = AskResponseSchema.safeParse(candidate);
  if (!parsed.success) {
    logPayloadViolation(logger, 'AskResponseSchema', nonEmpty(proto.correlationId));
    throw parsed.error;
  }
  return parsed.data;
}

export function mapProtoAskTurnStateToDomain(
  proto: ProtoAskTurnState | GetTurnResponse,
  logger?: SsrStructuredLogger,
): AskTurnState {
  const quota = mapProtoQuotaToDomain(proto.quota);
  const error = mapProtoPublicErrorToDomain(proto.error);
  const response = proto.response ? mapProtoAskResponseToDomain(proto.response, logger) : undefined;
  const candidate = {
    attemptId: proto.attemptId,
    status: proto.status,
    mode: proto.mode,
    ...(nonEmpty(proto.conversationId) ? { conversationId: proto.conversationId } : {}),
    ...(typeof proto.turnIndex === 'number' && proto.turnIndex > 0
      ? { turnIndex: proto.turnIndex }
      : {}),
    correlationId: proto.correlationId,
    leaseExpiresAt: proto.leaseExpiresAt,
    expiresAt: proto.expiresAt,
    ...(quota ? { quota } : {}),
    ...(response ? { response } : {}),
    ...(error ? { error } : {}),
  };
  const parsed = AskTurnStateSchema.safeParse(candidate);
  if (!parsed.success) {
    logPayloadViolation(logger, 'AskTurnStateSchema', nonEmpty(proto.correlationId));
    throw parsed.error;
  }
  return parsed.data;
}

export function mapProtoAskChunkToSse(
  chunk: AskStreamChunk,
  logger?: SsrStructuredLogger,
): MappedSseFrame | null {
  const payload = chunk.payload;
  switch (payload.case) {
    case 'status': {
      const data = { stage: payload.value.stage, label: payload.value.label };
      const check = AskStreamEventSchema.safeParse({ type: 'status', ...data });
      if (!check.success) {
        logPayloadViolation(logger, 'AskStreamStatusEventSchema', undefined);
        return null;
      }
      return { event: 'status', data };
    }
    case 'meta': {
      const v = payload.value;
      const data = {
        attemptId: v.attemptId,
        ...(nonEmpty(v.conversationId) ? { conversationId: v.conversationId } : {}),
        ...(typeof v.turnIndex === 'number' && v.turnIndex > 0 ? { turnIndex: v.turnIndex } : {}),
        correlationId: v.correlationId,
        mode: v.mode,
        provider: v.provider,
        ...(nonEmpty(v.model) ? { model: v.model } : {}),
      };
      const check = AskStreamEventSchema.safeParse({ type: 'meta', ...data });
      if (!check.success) {
        logPayloadViolation(logger, 'AskStreamMetaEventSchema', nonEmpty(v.correlationId));
        return null;
      }
      return { event: 'meta', data };
    }
    case 'preamble':
      return { event: 'preamble', data: { text: payload.value.text } };
    case 'preambleError': {
      const v = payload.value;
      const data = {
        code: v.code,
        message: v.message,
        ...(nonEmpty(v.action) ? { action: v.action } : {}),
        correlationId: v.correlationId,
      };
      const check = AskStreamEventSchema.safeParse({ type: 'preamble_error', ...data });
      if (!check.success) {
        logPayloadViolation(logger, 'AskStreamPreambleErrorEventSchema', nonEmpty(v.correlationId));
        return null;
      }
      return { event: 'preamble_error', data };
    }
    case 'sources': {
      const sources = payload.value.sources.map(mapProtoAskSourceToDomain);
      return { event: 'sources', data: { sources } };
    }
    case 'delta':
      return { event: 'delta', data: { text: payload.value.text } };
    case 'done': {
      const v = payload.value;
      const quota = mapProtoQuotaToDomain(v.quota);
      const data = {
        attemptId: v.attemptId,
        ...(nonEmpty(v.conversationId) ? { conversationId: v.conversationId } : {}),
        ...(typeof v.turnIndex === 'number' && v.turnIndex > 0 ? { turnIndex: v.turnIndex } : {}),
        grounded: v.grounded,
        abstained: v.abstained,
        ...(nonEmpty(v.groundingTier) ? { groundingTier: v.groundingTier } : {}),
        answer: v.answer,
        ...(v.suggestedLinks.length > 0
          ? {
              suggestedLinks: v.suggestedLinks.map(l => ({
                route: l.route,
                label: l.label,
                reason: l.reason,
              })),
            }
          : {}),
        ...(v.followUpQuestions.length > 0 ? { followUpQuestions: v.followUpQuestions } : {}),
        provider: v.provider,
        ...(nonEmpty(v.model) ? { model: v.model } : {}),
        tokensUsed: v.tokensUsed,
        usageEstimated: v.usageEstimated,
        ...(typeof v.latencyMs === 'number' ? { latencyMs: v.latencyMs } : {}),
        correlationId: v.correlationId,
        ...(quota ? { quota } : {}),
      };
      const check = AskStreamEventSchema.safeParse({ type: 'done', ...data });
      if (!check.success) {
        logPayloadViolation(logger, 'AskStreamDoneEventSchema', nonEmpty(v.correlationId));
        return null;
      }
      return { event: 'done', data };
    }
    case 'error': {
      const err = mapProtoPublicErrorToDomain(payload.value.error);
      if (!err) {
        logPayloadViolation(logger, 'AskStreamErrorEventSchema', undefined);
        return null;
      }
      const quota = mapProtoQuotaToDomain(payload.value.quota);
      return { event: 'error', data: { ...err, ...(quota ? { quota } : {}) } };
    }
    default:
      return null;
  }
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
  logPayloadViolation(meta.logger, 'AskUnaryResponse', meta.correlationId);
  throw new Error('AskService.Ask returned empty outcome oneof');
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
