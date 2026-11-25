import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createAiProviderFromEnv,
  createLocalAiProvider,
  createVertexAiProvider,
  parseVertexThinkingLevel,
} from '../src/ai.ts';

describe('@aklapper/node-runtime/ai', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('defaults to local llama-swap provider in dev and calls chat/embed endpoints', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        Response.json({
          model: 'inference-v2',
          choices: [{ message: { content: 'Solar Forge ready' } }],
          usage: { prompt_tokens: 12, completion_tokens: 4 },
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          data: [{ embedding: [0.1, 0.2, 0.3] }],
        }),
      );

    const provider = createAiProviderFromEnv({
      LOCAL_AI_BASE_URL: 'http://127.0.0.1:11434/v1/',
    });
    expect(provider.kind).toBe('local');

    const chat = await provider.generateText({
      systemPrompt: 'Be concise',
      prompt: 'Ping',
      maxTokens: 64,
    });
    expect(chat).toEqual({
      text: 'Solar Forge ready',
      model: 'inference-v2',
      tokensIn: 12,
      tokensOut: 4,
    });
    expect(fetchSpy).toHaveBeenNthCalledWith(
      1,
      'http://127.0.0.1:11434/v1/chat/completions',
      expect.objectContaining({ method: 'POST' }),
    );

    const vectors = await provider.embed(['hello']);
    expect(vectors).toEqual([[0.1, 0.2, 0.3]]);
    expect(fetchSpy).toHaveBeenNthCalledWith(
      2,
      'http://127.0.0.1:11434/v1/embeddings',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"model":"embedding"'),
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it('throws clear errors when local AI HTTP requests fail', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('bad gateway', { status: 502 }))
      .mockResolvedValueOnce(new Response('unavailable', { status: 503 }));

    const provider = createLocalAiProvider({ baseUrl: 'http://127.0.0.1:11434/v1' });
    await expect(provider.generateText({ prompt: 'test' })).rejects.toThrow(/status 502/);
    await expect(provider.embed(['test'])).rejects.toThrow(/status 503/);
  });

  it('requires GCP_PROJECT_ID when AI_PROVIDER=vertex and fails loud when metadata server is unreachable', async () => {
    expect(() => createAiProviderFromEnv({ AI_PROVIDER: 'vertex' })).toThrow('GCP_PROJECT_ID');
    const vertex = createAiProviderFromEnv({
      AI_PROVIDER: 'vertex',
      GCP_PROJECT_ID: 'aklapper-prod',
    });
    expect(vertex.kind).toBe('vertex');

    const failingFetch = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error('connect ECONNREFUSED metadata.google.internal'));
    const directVertex = createVertexAiProvider({
      projectId: 'aklapper-prod',
      location: 'us-central1',
      fetchImpl: failingFetch,
    });
    await expect(directVertex.generateText({ prompt: 'hi' })).rejects.toThrow(
      /aklapper-prod\/us-central1/,
    );
    await expect(directVertex.embed(['hi'])).rejects.toThrow(/Workload Identity/);
  });

  it('calls Vertex AI generateContent and predict using metadata server or GOOGLE_OAUTH_ACCESS_TOKEN', async () => {
    const mockFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ access_token: 'meta-token-123' }))
      .mockResolvedValueOnce(
        Response.json({
          candidates: [
            {
              content: {
                parts: [{ text: 'Vertex grounded answer' }],
              },
            },
          ],
          usageMetadata: {
            promptTokenCount: 18,
            candidatesTokenCount: 7,
          },
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          predictions: [{ embeddings: { values: [0.25, 0.5, 0.75] } }],
        }),
      );

    const metadataVertex = createVertexAiProvider({
      projectId: 'aklapper-prod',
      location: 'us-central1',
      geminiModel: 'gemini-2.5-flash',
      embedModel: 'text-embedding-005',
      fetchImpl: mockFetch,
    });

    const chat = await metadataVertex.generateText({
      systemPrompt: 'Stay grounded',
      prompt: 'Summarize portfolio',
      maxTokens: 256,
    });
    expect(chat).toEqual({
      text: 'Vertex grounded answer',
      model: 'gemini-2.5-flash',
      tokensIn: 18,
      tokensOut: 7,
    });
    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token',
      expect.objectContaining({
        headers: { 'Metadata-Flavor': 'Google' },
      }),
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      'https://us-central1-aiplatform.googleapis.com/v1/projects/aklapper-prod/locations/us-central1/publishers/google/models/gemini-2.5-flash:generateContent',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ authorization: 'Bearer meta-token-123' }),
      }),
    );

    const envTokenVertex = createVertexAiProvider({
      projectId: 'aklapper-prod',
      location: 'us-central1',
      embedModel: 'text-embedding-005',
      accessToken: 'env-token-456',
      fetchImpl: mockFetch,
    });
    const vectors = await envTokenVertex.embed(['Solar Forge']);
    expect(vectors).toEqual([[0.25, 0.5, 0.75]]);
    expect(mockFetch).toHaveBeenNthCalledWith(
      3,
      'https://us-central1-aiplatform.googleapis.com/v1/projects/aklapper-prod/locations/us-central1/publishers/google/models/text-embedding-005:predict',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ authorization: 'Bearer env-token-456' }),
      }),
    );
  });

  it('prefers canonical LOCAL_LLM_* and VERTEX_MODEL env vars over legacy aliases', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        Response.json({
          model: 'canonical-chat',
          choices: [{ message: { content: 'ok' } }],
          usage: { prompt_tokens: 1, completion_tokens: 1 },
        }),
      )
      .mockResolvedValueOnce(Response.json({ data: [{ embedding: [0.5] }] }));

    const provider = createAiProviderFromEnv({
      LOCAL_LLM_BASE_URL: 'http://127.0.0.1:11434/v1',
      LOCAL_AI_BASE_URL: 'http://legacy.invalid/v1',
      LOCAL_LLM_CHAT_MODEL: 'canonical-chat',
      LOCAL_CHAT_MODEL: 'legacy-chat',
      LOCAL_LLM_EMBED_MODEL: 'canonical-embed',
      LOCAL_EMBED_MODEL: 'legacy-embed',
    });

    await provider.generateText({ prompt: 'ping' });
    await provider.embed(['vec']);

    expect(fetchSpy).toHaveBeenNthCalledWith(
      1,
      'http://127.0.0.1:11434/v1/chat/completions',
      expect.objectContaining({
        body: expect.stringContaining('"model":"canonical-chat"'),
      }),
    );
    expect(fetchSpy).toHaveBeenNthCalledWith(
      2,
      'http://127.0.0.1:11434/v1/embeddings',
      expect.objectContaining({
        body: expect.stringContaining('"model":"canonical-embed"'),
      }),
    );

    const vertex = createAiProviderFromEnv({
      AI_PROVIDER: 'vertex',
      GCP_PROJECT_ID: 'aklapper-prod',
      VERTEX_MODEL: 'gemini-2.5-flash',
      VERTEX_EMBED_MODEL: 'text-embedding-005',
    });
    expect(vertex.kind).toBe('vertex');
  });

  it('defaults Vertex AI to global apex host, gemini-3.8-flash (LOW thinking), and filters thought parts', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const mockFetch = vi.fn<typeof fetch>(async (input, init) => {
      const url = typeof input === 'string' ? input : input.toString();
      calls.push({ url, init });
      return Response.json({
        candidates: [
          {
            content: {
              parts: [{ text: 'internal reasoning', thought: true }, { text: 'final answer' }],
            },
          },
        ],
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 },
      });
    });

    const provider = createVertexAiProvider({
      projectId: 'games-424800',
      location: '  GLOBAL  ',
      accessToken: 'secret-token',
      fetchImpl: mockFetch,
    });

    const res = await provider.generateText({ prompt: 'Hello' });
    expect(res).toEqual({
      text: 'final answer',
      model: 'gemini-3.8-flash',
      tokensIn: 10,
      tokensOut: 5,
    });
    expect(calls[0]?.url).toBe(
      'https://aiplatform.googleapis.com/v1/projects/games-424800/locations/global/publishers/google/models/gemini-3.8-flash:generateContent',
    );
    const body = JSON.parse(String(calls[0]?.init?.body)) as {
      generationConfig?: { thinkingConfig?: Record<string, unknown> };
    };
    expect(body.generationConfig?.thinkingConfig).toEqual({ thinkingLevel: 'LOW' });
    expect(body.generationConfig?.thinkingConfig).not.toHaveProperty('thinkingBudget');

    expect(parseVertexThinkingLevel(undefined)).toBe('LOW');
    expect(parseVertexThinkingLevel(' medium ')).toBe('MEDIUM');
    expect(() => parseVertexThinkingLevel('MINIMAL')).toThrow(/VERTEX_THINKING_LEVEL/);
    expect(() =>
      createAiProviderFromEnv({
        AI_PROVIDER: 'vertex',
        GCP_PROJECT_ID: 'games-424800',
        VERTEX_THINKING_LEVEL: 'MINIMAL',
      }),
    ).toThrow(/VERTEX_THINKING_LEVEL/);
  });

  it('dispatches gemini-embedding-2 to :embedContent with 768 dims, bounded concurrency <= 4, order preservation, and abort-on-error', async () => {
    const vecFor = (seed: number): number[] =>
      Array.from({ length: 768 }, (_, i) => seed + i * 0.001);

    // 1. Empty array makes zero HTTP calls
    const emptyFetch = vi.fn<typeof fetch>();
    const emptyProvider = createVertexAiProvider({
      projectId: 'games-424800',
      fetchImpl: emptyFetch,
    });
    expect(await emptyProvider.embed([])).toEqual([]);
    expect(emptyFetch).not.toHaveBeenCalled();

    // 2. 10 inputs: concurrency <= 4, single metadata token fetch, order preserved
    let metadataCalls = 0;
    let inFlight = 0;
    let peakInFlight = 0;
    const mockFetch = vi.fn<typeof fetch>(async (input, init) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('metadata.google.internal')) {
        metadataCalls += 1;
        return Response.json({ access_token: 'batch-token' });
      }
      expect(url).toBe(
        'https://aiplatform.googleapis.com/v1/projects/games-424800/locations/global/publishers/google/models/gemini-embedding-2:embedContent',
      );
      const parsed = JSON.parse(String(init?.body)) as {
        content: { parts: Array<{ text: string }> };
        outputDimensionality: number;
        config?: unknown;
      };
      expect(parsed.outputDimensionality).toBe(768);
      expect(parsed.config).toBeUndefined();
      const idx = Number(parsed.content.parts[0]?.text.replace('item-', ''));
      inFlight += 1;
      peakInFlight = Math.max(peakInFlight, inFlight);
      await new Promise(resolve => setTimeout(resolve, (10 - idx) * 4));
      inFlight -= 1;
      return Response.json({ embedding: { values: vecFor(idx) } });
    });

    const provider = createVertexAiProvider({
      projectId: 'games-424800',
      location: '',
      fetchImpl: mockFetch,
    });
    const texts = Array.from({ length: 10 }, (_, i) => `item-${i}`);
    const vectors = await provider.embed(texts);
    expect(metadataCalls).toBe(1);
    expect(peakInFlight).toBeLessThanOrEqual(4);
    expect(vectors).toHaveLength(10);
    for (let i = 0; i < 10; i += 1) {
      expect(vectors[i]).toHaveLength(768);
      expect(vectors[i]?.[0]).toBe(i);
    }

    // 3. Wrong-dim response fails closed
    const badDimFetch = vi.fn<typeof fetch>(async () =>
      Response.json({ embedding: { values: Array.from({ length: 3072 }, () => 0.1) } }),
    );
    const badDimProvider = createVertexAiProvider({
      projectId: 'games-424800',
      accessToken: 'tok',
      fetchImpl: badDimFetch,
    });
    await expect(badDimProvider.embed(['hello'])).rejects.toThrow(/768/);

    // 4. Mid-batch failure aborts sibling in-flight requests
    let abortedSiblings = 0;
    let callCount = 0;
    const abortFetch = vi.fn<typeof fetch>(async (_input, init) => {
      const current = callCount++;
      if (current === 0) {
        return new Response('unavailable', { status: 503 });
      }
      return await new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          abortedSiblings += 1;
          reject(new Error('aborted'));
        });
      });
    });
    const abortProvider = createVertexAiProvider({
      projectId: 'games-424800',
      accessToken: 'tok',
      fetchImpl: abortFetch,
    });
    await expect(abortProvider.embed(['a', 'b', 'c', 'd'])).rejects.toThrow(/503/);
    expect(abortedSiblings).toBeGreaterThanOrEqual(1);

    // 5. Legacy gemini-embedding-001 uses :predict with parameters.outputDimensionality=768
    let legacyBody = '';
    const legacyFetch = vi.fn<typeof fetch>(async (input, init) => {
      const url = typeof input === 'string' ? input : input.toString();
      expect(url).toBe(
        'https://us-central1-aiplatform.googleapis.com/v1/projects/games-424800/locations/us-central1/publishers/google/models/gemini-embedding-001:predict',
      );
      legacyBody = String(init?.body ?? '');
      return Response.json({ predictions: [{ embeddings: { values: vecFor(1) } }] });
    });
    const legacyProvider = createVertexAiProvider({
      projectId: 'games-424800',
      location: 'us-central1',
      embedModel: 'gemini-embedding-001',
      accessToken: 'tok',
      fetchImpl: legacyFetch,
    });
    const legacyVecs = await legacyProvider.embed(['legacy']);
    expect(legacyVecs).toHaveLength(1);
    expect(JSON.parse(legacyBody)).toMatchObject({
      instances: [{ content: 'legacy' }],
      parameters: { outputDimensionality: 768 },
    });
  });
});
