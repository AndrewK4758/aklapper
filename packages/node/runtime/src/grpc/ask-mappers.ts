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

import type { SsrStructuredLogger } from '../request-context.ts';
import { GrpcPayloadContractError, mapProtoQuotaToDomain } from './errors.ts';
import type {
  AskResponse as ProtoAskResponse,
  AskSource as ProtoAskSource,
  AskStreamChunk,
  AskTurnState as ProtoAskTurnState,
  GetTurnResponse,
} from './gen/ai_ask/v1/ask_pb.ts';
import type { PublicAppError as ProtoPublicAppError } from './gen/common/v1/error_pb.ts';
import type { MappedSseFrame } from './sse-bridge.ts';

function nonEmpty(raw: string | undefined): string | undefined {
  return raw && raw.length > 0 ? raw : undefined;
}

export function logAskPayloadViolation(
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
  const parsed = AskSourceSchema.safeParse(candidate);
  if (!parsed.success) {
    throw new GrpcPayloadContractError('AskSourceSchema', parsed.error.message);
  }
  return parsed.data;
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
    logAskPayloadViolation(logger, 'AskResponseSchema', nonEmpty(proto.correlationId));
    throw new GrpcPayloadContractError('AskResponseSchema', parsed.error.message);
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
    logAskPayloadViolation(logger, 'AskTurnStateSchema', nonEmpty(proto.correlationId));
    throw new GrpcPayloadContractError('AskTurnStateSchema', parsed.error.message);
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
        logAskPayloadViolation(logger, 'AskStreamStatusEventSchema', undefined);
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
        logAskPayloadViolation(logger, 'AskStreamMetaEventSchema', nonEmpty(v.correlationId));
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
        logAskPayloadViolation(
          logger,
          'AskStreamPreambleErrorEventSchema',
          nonEmpty(v.correlationId),
        );
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
        logAskPayloadViolation(logger, 'AskStreamDoneEventSchema', nonEmpty(v.correlationId));
        return null;
      }
      return { event: 'done', data };
    }
    case 'error': {
      const err = mapProtoPublicErrorToDomain(payload.value.error);
      if (!err) {
        logAskPayloadViolation(logger, 'AskStreamErrorEventSchema', undefined);
        return null;
      }
      const quota = mapProtoQuotaToDomain(payload.value.quota);
      return { event: 'error', data: { ...err, ...(quota ? { quota } : {}) } };
    }
    default:
      return null;
  }
}
