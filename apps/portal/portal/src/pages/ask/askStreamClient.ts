import {
  type AskResponse,
  type AskSource,
  AskStreamDoneEventSchema,
  AskStreamMetaEventSchema,
  AskStreamSourcesEventSchema,
  AskStreamStatusEventSchema,
  consumePostSseStream,
  type QuotaStatus,
  StreamErrorPayloadSchema,
  StreamHttpError,
} from '@aklapper/core';

import { type RecoveredErrorState } from './askTurnRecovery';

export interface ActiveAskStreamState {
  readonly attemptId: string;
  readonly conversationId: string;
  readonly question: string;
  readonly statusLabel: string;
  readonly text: string;
  readonly sources: readonly AskSource[];
}

export interface StreamAskQuestionOptions {
  readonly url: string;
  readonly question: string;
  readonly attemptId: string;
  readonly conversationId: string;
  readonly visitorLens?: string;
  readonly signal: AbortSignal;
  readonly onStatus: (label: string) => void;
  readonly onMeta: (meta: { conversationId?: string; turnIndex?: number }) => void;
  readonly onSources: (sources: readonly AskSource[]) => void;
  readonly onDelta: (deltaText: string) => void;
  readonly onDone: (response: AskResponse) => void;
  readonly onError: (error: RecoveredErrorState, quota?: QuotaStatus) => void;
}

export function generateConversationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return '22222222-2222-4222-8222-222222222222';
}

function parseJsonSafe(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function streamAskQuestion(options: StreamAskQuestionOptions): Promise<void> {
  const {
    url,
    question,
    attemptId,
    conversationId,
    visitorLens,
    signal,
    onStatus,
    onMeta,
    onSources,
    onDelta,
    onDone,
    onError,
  } = options;

  let latestSources: readonly AskSource[] = [];
  let terminalReceived = false;
  let accumulatedText = '';

  try {
    await consumePostSseStream({
      url,
      body: {
        mode: 'qa',
        question,
        attemptId,
        conversationId,
        ...(visitorLens ? { visitorLens } : {}),
      },
      credentials: 'same-origin',
      signal,
      onFrame: frame => {
        const parsed = parseJsonSafe(frame.data);
        if (!parsed || typeof parsed !== 'object') {
          return;
        }
        const payload = parsed as Record<string, unknown>;

        if (frame.event === 'status') {
          const status = AskStreamStatusEventSchema.safeParse({ type: 'status', ...payload });
          if (status.success) {
            onStatus(status.data.label);
          }
          return;
        }

        if (frame.event === 'meta') {
          const meta = AskStreamMetaEventSchema.safeParse({ type: 'meta', ...payload });
          if (meta.success) {
            onMeta({
              conversationId: meta.data.conversationId,
              turnIndex: meta.data.turnIndex,
            });
          }
          return;
        }

        if (frame.event === 'sources') {
          const sources = AskStreamSourcesEventSchema.safeParse({ type: 'sources', ...payload });
          if (sources.success) {
            latestSources = sources.data.sources;
            onSources(sources.data.sources);
          }
          return;
        }

        if (frame.event === 'delta') {
          const text = typeof payload['text'] === 'string' ? payload['text'] : '';
          if (text) {
            accumulatedText += text;
            onDelta(text);
          }
          return;
        }

        if (frame.event === 'done') {
          const done = AskStreamDoneEventSchema.safeParse({ type: 'done', ...payload });
          if (done.success) {
            terminalReceived = true;
            onDone({
              attemptId: done.data.attemptId,
              conversationId: done.data.conversationId ?? conversationId,
              turnIndex: done.data.turnIndex,
              grounded: done.data.grounded,
              abstained: done.data.abstained,
              groundingTier: done.data.groundingTier,
              mode: 'qa',
              answer: done.data.answer || accumulatedText,
              sources: [...latestSources],
              suggestedLinks: done.data.suggestedLinks,
              followUpQuestions: done.data.followUpQuestions,
              provider: done.data.provider,
              model: done.data.model,
              tokensUsed: done.data.tokensUsed,
              latencyMs: done.data.latencyMs,
              correlationId: done.data.correlationId,
              quota: done.data.quota,
            });
          }
          return;
        }

        if (frame.event === 'error') {
          const errPayload = StreamErrorPayloadSchema.safeParse(payload);
          terminalReceived = true;
          if (errPayload.success) {
            onError(
              {
                ok: false,
                mode: 'qa',
                error: errPayload.data.message,
                code: errPayload.data.code,
                action: errPayload.data.action,
                correlationId: errPayload.data.correlationId,
              },
              errPayload.data.quota,
            );
          } else {
            onError({
              ok: false,
              mode: 'qa',
              error: 'Streaming response interrupted before completion.',
              code: 'ERR_UPSTREAM_UNAVAILABLE',
              action: 'Retry your question.',
            });
          }
        }
      },
    });

    if (!terminalReceived && !signal.aborted) {
      onError({
        ok: false,
        mode: 'qa',
        error: 'Streaming connection closed before completion.',
        code: 'ERR_UPSTREAM_UNAVAILABLE',
        action: 'Retry your question.',
      });
    }
  } catch (err) {
    if (signal.aborted) {
      return;
    }
    if (err instanceof StreamHttpError) {
      onError(
        {
          ok: false,
          mode: 'qa',
          error: err.publicError.message,
          code: err.publicError.code,
          action: err.publicError.action,
          correlationId: err.publicError.correlationId,
        },
        err.quota,
      );
      return;
    }
    onError({
      ok: false,
      mode: 'qa',
      error: 'Unable to reach streaming assistant endpoint.',
      code: 'ERR_UPSTREAM_UNAVAILABLE',
      action: 'Retry shortly or refresh.',
    });
  }
}
