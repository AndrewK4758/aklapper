import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  AskStreamEventSchema,
  consumePostSseStream,
  createSseParser,
  parseSseChunk,
  StreamErrorPayloadSchema,
  StreamHttpError,
  type SseFrame,
} from '../src/sse.ts';

describe('@aklapper/core/sse WHATWG POST SSE parser', () => {
  it('decodes split CRLF, multi-byte UTF-8 emojis, comment keepalives, and single-leading-space multi-line data', async () => {
    const encoder = new TextEncoder();
    const emojiBytes = encoder.encode('🚀'); // 4-byte UTF-8 sequence
    const chunks: Uint8Array[] = [
      encoder.encode(': keepalive\r'),
      encoder.encode('\n\r\n'),
      encoder.encode('event: delta\r'),
      encoder.encode('\ndata:  indented '),
      emojiBytes.subarray(0, 2),
      emojiBytes.subarray(2),
      encoder.encode('\ndata: line2\nid: evt-1\n\n'),
    ];

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(chunk);
        }
        controller.close();
      },
    });

    const streamedFrames: SseFrame[] = [];
    const frames = await consumePostSseStream({
      url: 'https://andrew-k.us/api/ask/stream',
      body: { question: 'Hello' },
      fetchImpl: async () =>
        new Response(stream, {
          status: 200,
          headers: { 'content-type': 'text/event-stream; charset=utf-8' },
        }),
      onFrame: frame => streamedFrames.push(frame),
    });

    expect(frames).toHaveLength(1);
    expect(streamedFrames).toEqual(frames);
    expect(frames[0]).toEqual({
      event: 'delta',
      data: ' indented 🚀\nline2',
      id: 'evt-1',
    });
  });

  it('aborts cleanly via AbortSignal and validates 429 PublicAppError + QuotaStatus via StreamErrorPayloadSchema', async () => {
    const controller = new AbortController();
    let cancelled = false;
    const encoder = new TextEncoder();

    const hangingStream = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(encoder.encode('event: meta\ndata: {"ok":true}\n\n'));
      },
      cancel() {
        cancelled = true;
      },
    });

    const received: SseFrame[] = [];
    const promise = consumePostSseStream({
      url: 'https://andrew-k.us/api/ask/stream',
      body: { question: 'Abort me' },
      signal: controller.signal,
      fetchImpl: async () =>
        new Response(hangingStream, {
          status: 200,
          headers: { 'content-type': 'text/event-stream' },
        }),
      onFrame: frame => {
        received.push(frame);
        controller.abort();
      },
    });

    const frames = await promise;
    expect(frames).toHaveLength(1);
    expect(received[0]?.event).toBe('meta');
    expect(cancelled).toBe(true);

    const quotaPayload = {
      code: 'ERR_RATE_LIMITED',
      status: 429,
      message: 'Too many requests received.',
      action: 'Wait a moment and submit again.',
      correlationId: 'corr-429',
      quota: {
        role: 'guest',
        turnsUsed: 5,
        maxTurns: 5,
        tokensUsed: 1200,
        maxTokens: 20000,
      },
    };
    expect(StreamErrorPayloadSchema.safeParse(quotaPayload).success).toBe(true);

    let caught: unknown;
    try {
      await consumePostSseStream({
        url: 'https://andrew-k.us/api/ask/stream',
        body: { question: 'Over quota' },
        fetchImpl: async () => Response.json(quotaPayload, { status: 429 }),
      });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(StreamHttpError);
    const streamErr = caught as StreamHttpError;
    expect(streamErr.status).toBe(429);
    expect(streamErr.publicError.code).toBe('ERR_RATE_LIMITED');
    expect(streamErr.quota?.turnsUsed).toBe(5);
  });

  it('obeys WHATWG id NUL ignore and golden-file serialization parity', () => {
    const frames = parseSseChunk(
      ': keepalive\n\nevent: sources\nid: bad\0id\ndata: {"sources":[]}\n\nretry: 1500\ndata: ok\n\n',
    );
    expect(frames).toEqual([
      { event: 'sources', data: '{"sources":[]}' },
      { event: 'message', data: 'ok', retry: 1500 },
    ]);

    const manual: SseFrame[] = [];
    const p = createSseParser(f => manual.push(f));
    p.feed('data: a\rdata: b\r\n\r\n');
    p.flush();
    expect(manual).toEqual([{ event: 'message', data: 'a\nb' }]);

    // WHATWG HTML §9.2.6: incomplete trailing frames without blank-line termination are discarded on EOF.
    const truncated: SseFrame[] = [];
    const pTrunc = createSseParser(f => truncated.push(f));
    pTrunc.feed(
      'event: delta\ndata: {"text":"complete"}\n\nevent: delta\ndata: {"text":"half-json',
    );
    pTrunc.flush();
    expect(truncated).toEqual([{ event: 'delta', data: '{"text":"complete"}' }]);
  });

  it('contains strictly zero node:* imports, zero Buffer usage, exports ./sse, and keeps index.ts re-export-only', () => {
    const coreRoot = resolve(import.meta.dirname, '..');
    const sseSrc = readFileSync(resolve(coreRoot, 'src/sse.ts'), 'utf8');
    const indexSrc = readFileSync(resolve(coreRoot, 'src/index.ts'), 'utf8');
    const pkgJson = JSON.parse(readFileSync(resolve(coreRoot, 'package.json'), 'utf8')) as {
      exports: Record<string, unknown>;
    };

    expect(sseSrc).not.toMatch(/from\s+['"]node:/);
    expect(sseSrc).not.toMatch(/\bBuffer\b/);
    expect(pkgJson.exports['./sse']).toBeDefined();

    const nonEmptyIndexLines = indexSrc
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean);
    for (const line of nonEmptyIndexLines) {
      expect(line).toMatch(/^export\s+\*\s+from\s+['"]\.\/[^'"]+['"];$/);
    }

    expect(
      AskStreamEventSchema.parse({
        type: 'status',
        stage: 'retrieving',
        label: 'Searching portfolio records...',
      }),
    ).toEqual({
      type: 'status',
      stage: 'retrieving',
      label: 'Searching portfolio records...',
    });

    const parsedDone = AskStreamEventSchema.parse({
      type: 'done',
      attemptId: '11111111-1111-4111-8111-111111111111',
      conversationId: '22222222-2222-4222-8222-222222222222',
      turnIndex: 2,
      grounded: true,
      abstained: false,
      groundingTier: 'evidence',
      answer: 'Andrew built streaming SSR and Go microservices.',
      suggestedLinks: [
        { route: '/cadence', label: 'CADENCE Builder', reason: 'Inspect interactive sandbox.' },
      ],
      followUpQuestions: ['How are migrations verified?'],
      provider: 'local-llama-swap',
      tokensUsed: 120,
      correlationId: 'corr-done-1',
    });
    expect(parsedDone.type).toBe('done');
  });
});
