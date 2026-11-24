import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createAiProviderFromEnv,
  createLocalAiProvider,
  createVertexAiProvider,
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
      expect.objectContaining({ method: 'POST' }),
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

  it('requires GCP_PROJECT_ID when AI_PROVIDER=vertex and fails loud without credentials', async () => {
    expect(() => createAiProviderFromEnv({ AI_PROVIDER: 'vertex' })).toThrow('GCP_PROJECT_ID');
    const vertex = createAiProviderFromEnv({
      AI_PROVIDER: 'vertex',
      GCP_PROJECT_ID: 'aklapper-prod',
    });
    expect(vertex.kind).toBe('vertex');

    const directVertex = createVertexAiProvider({
      projectId: 'aklapper-prod',
      location: 'us-central1',
    });
    await expect(directVertex.generateText({ prompt: 'hi' })).rejects.toThrow(/aklapper-prod/);
    await expect(directVertex.embed(['hi'])).rejects.toThrow(/Workload Identity/);
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
});
