import { z } from 'zod';

import { AskSourceSchema } from './ask.ts';
import { QuotaStatusSchema, type QuotaStatus } from './auth.ts';
import { createPublicAppError, PublicAppErrorSchema, type PublicAppError } from './errors.ts';

export interface SseFrame {
  readonly event: string;
  readonly data: string;
  readonly id?: string;
  readonly retry?: number;
}

export const StreamErrorPayloadSchema = z
  .object({
    ...PublicAppErrorSchema.shape,
    quota: QuotaStatusSchema.optional(),
  })
  .strict();
export type StreamErrorPayload = z.infer<typeof StreamErrorPayloadSchema>;

export const AskStreamMetaEventSchema = z.object({
  type: z.literal('meta'),
  attemptId: z.string().min(1),
  correlationId: z.string().min(1),
  mode: z.string().min(1),
  provider: z.string().min(1),
  model: z.string().optional(),
});

export const AskStreamSourcesEventSchema = z.object({
  type: z.literal('sources'),
  sources: z.array(AskSourceSchema),
});

export const AskStreamDeltaEventSchema = z.object({
  type: z.literal('delta'),
  text: z.string(),
});

export const AskStreamDoneEventSchema = z.object({
  type: z.literal('done'),
  attemptId: z.string().min(1),
  grounded: z.boolean(),
  abstained: z.boolean(),
  answer: z.string(),
  provider: z.string().min(1),
  model: z.string().optional(),
  tokensUsed: z.number().int().nonnegative(),
  usageEstimated: z.boolean().optional(),
  latencyMs: z.number().int().nonnegative().optional(),
  correlationId: z.string().min(1),
  quota: QuotaStatusSchema.optional(),
});

export const AskStreamErrorEventSchema = z.object({
  type: z.literal('error'),
  error: StreamErrorPayloadSchema,
});

export const AskStreamEventSchema = z.discriminatedUnion('type', [
  AskStreamMetaEventSchema,
  AskStreamSourcesEventSchema,
  AskStreamDeltaEventSchema,
  AskStreamDoneEventSchema,
  AskStreamErrorEventSchema,
]);
export type AskStreamEvent = z.infer<typeof AskStreamEventSchema>;

export class StreamHttpError extends Error {
  readonly status: number;
  readonly publicError: PublicAppError;
  readonly quota?: QuotaStatus;
  readonly payload: StreamErrorPayload;

  constructor(status: number, payload: StreamErrorPayload) {
    super(payload.message);
    this.name = 'StreamHttpError';
    this.status = status;
    this.payload = payload;
    this.quota = payload.quota;
    this.publicError = createPublicAppError({
      code: payload.code,
      status: payload.status,
      message: payload.message,
      action: payload.action,
      correlationId: payload.correlationId,
      ...(payload.fieldErrors ? { fieldErrors: payload.fieldErrors } : {}),
    });
  }
}

export interface SseParser {
  readonly feed: (chunk: Uint8Array | string) => void;
  readonly flush: () => void;
}

/**
 * Creates a WHATWG HTML Living Standard compliant incremental SSE frame parser. Uses Web
 * TextDecoder({ stream: true }) with zero Node built-ins so browser bundles stay clean.
 */
export function createSseParser(onFrame: (frame: SseFrame) => void): SseParser {
  const decoder = new TextDecoder('utf-8', { fatal: false });
  let pendingLine = '';
  let pendingCr = false;
  let eventName = '';
  let dataLines: string[] = [];
  let lastEventId: string | undefined;
  let retryMs: number | undefined;

  const dispatchFrame = (): void => {
    if (dataLines.length === 0) {
      eventName = '';
      retryMs = undefined;
      return;
    }
    const frame: SseFrame = {
      event: eventName || 'message',
      data: dataLines.join('\n'),
      ...(lastEventId !== undefined ? { id: lastEventId } : {}),
      ...(retryMs !== undefined ? { retry: retryMs } : {}),
    };
    eventName = '';
    dataLines = [];
    retryMs = undefined;
    onFrame(frame);
  };

  const processLine = (line: string): void => {
    if (line.length === 0) {
      dispatchFrame();
      return;
    }
    if (line.startsWith(':')) {
      return;
    }
    const colonIdx = line.indexOf(':');
    const field = colonIdx === -1 ? line : line.slice(0, colonIdx);
    let value = colonIdx === -1 ? '' : line.slice(colonIdx + 1);
    // WHATWG SSE spec: remove at most ONE leading U+0020 SPACE.
    if (value.startsWith(' ')) {
      value = value.slice(1);
    }

    switch (field) {
      case 'event':
        eventName = value;
        break;
      case 'data':
        dataLines.push(value);
        break;
      case 'id':
        if (!value.includes('\0')) {
          lastEventId = value;
        }
        break;
      case 'retry':
        if (/^\d+$/.test(value)) {
          retryMs = Number(value);
        }
        break;
      default:
        break;
    }
  };

  const processText = (text: string): void => {
    let start = 0;
    for (let i = 0; i < text.length; i += 1) {
      const ch = text[i];
      if (pendingCr) {
        pendingCr = false;
        if (ch === '\n') {
          start = i + 1;
          continue;
        }
      }
      if (ch === '\r') {
        pendingLine += text.slice(start, i);
        processLine(pendingLine);
        pendingLine = '';
        pendingCr = true;
        start = i + 1;
      } else if (ch === '\n') {
        pendingLine += text.slice(start, i);
        processLine(pendingLine);
        pendingLine = '';
        start = i + 1;
      }
    }
    if (start < text.length) {
      pendingLine += text.slice(start);
    }
  };

  return {
    feed(chunk: Uint8Array | string): void {
      const text = typeof chunk === 'string' ? chunk : decoder.decode(chunk, { stream: true });
      if (text.length > 0) {
        processText(text);
      }
    },
    flush(): void {
      const tail = decoder.decode();
      if (tail.length > 0) {
        processText(tail);
      }
      // WHATWG HTML §9.2.6: discard incomplete trailing frame buffers on EOF.
      pendingLine = '';
      pendingCr = false;
      eventName = '';
      dataLines = [];
      retryMs = undefined;
    },
  };
}

export function parseSseChunk(raw: string): SseFrame[] {
  const frames: SseFrame[] = [];
  const parser = createSseParser(frame => {
    frames.push(frame);
  });
  parser.feed(raw);
  parser.flush();
  return frames;
}

export interface ConsumePostSseOptions {
  readonly url: string;
  readonly body?: unknown;
  readonly headers?: HeadersInit;
  readonly signal?: AbortSignal;
  readonly credentials?: RequestCredentials;
  readonly fetchImpl?: typeof fetch;
  readonly onFrame?: (frame: SseFrame) => void;
}

function parseErrorPayload(
  rawText: string,
  status: number,
  correlationId: string,
): StreamErrorPayload {
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawText);
  } catch {
    parsedJson = undefined;
  }
  if (parsedJson !== undefined) {
    const strict = StreamErrorPayloadSchema.safeParse(parsedJson);
    if (strict.success) {
      return strict.data;
    }
  }

  return StreamErrorPayloadSchema.parse({
    code:
      status === 429
        ? 'ERR_RATE_LIMITED'
        : status === 403
          ? 'ERR_FORBIDDEN'
          : status === 401
            ? 'ERR_UNAUTHORIZED'
            : status === 504
              ? 'ERR_STREAM_TIMEOUT'
              : status >= 500
                ? 'ERR_UPSTREAM_UNAVAILABLE'
                : 'ERR_VALIDATION',
    status: status >= 400 && status <= 599 ? status : 502,
    message: 'Request could not be completed.',
    action: 'Retry shortly or refresh.',
    correlationId: correlationId.trim().slice(0, 128) || 'unknown',
  });
}

export async function consumePostSseStream(options: ConsumePostSseOptions): Promise<SseFrame[]> {
  const {
    url,
    body,
    headers,
    signal,
    credentials,
    fetchImpl = globalThis.fetch,
    onFrame,
  } = options;

  const requestHeaders = new Headers(headers);
  requestHeaders.set('accept', 'text/event-stream');
  if (body !== undefined && !requestHeaders.has('content-type')) {
    requestHeaders.set('content-type', 'application/json');
  }

  const response = await fetchImpl(url, {
    method: 'POST',
    headers: requestHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
    ...(credentials !== undefined ? { credentials } : {}),
  });

  if (!response.ok) {
    const corrId = response.headers.get('x-correlation-id') ?? 'unknown';
    const rawText = await response.text().catch(() => '');
    const payload = parseErrorPayload(rawText, response.status, corrId);
    throw new StreamHttpError(response.status, payload);
  }

  if (!response.body) {
    return [];
  }

  const frames: SseFrame[] = [];
  const parser = createSseParser(frame => {
    frames.push(frame);
    onFrame?.(frame);
  });

  const reader = response.body.getReader();
  const handleAbort = (): void => {
    void reader.cancel().catch(() => undefined);
  };
  if (signal) {
    if (signal.aborted) {
      handleAbort();
      return frames;
    }
    signal.addEventListener('abort', handleAbort, { once: true });
  }

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (value && value.byteLength > 0) {
        parser.feed(value);
      }
      if (signal?.aborted) {
        break;
      }
    }
    if (!signal?.aborted) {
      parser.flush();
    }
    return frames;
  } catch (err) {
    if (signal?.aborted) {
      return frames;
    }
    throw err;
  } finally {
    if (signal) {
      signal.removeEventListener('abort', handleAbort);
    }
    reader.releaseLock();
  }
}
