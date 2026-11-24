import { createAiProviderFromEnv } from '../src/index.ts';

describe('@aklapper/ai', () => {
  it('defaults to local llama-swap provider in dev', () => {
    const provider = createAiProviderFromEnv({});
    expect(provider.kind).toBe('local');
  });

  it('requires GCP_PROJECT_ID when AI_PROVIDER=vertex', () => {
    expect(() => createAiProviderFromEnv({ AI_PROVIDER: 'vertex' })).toThrow('GCP_PROJECT_ID');
    const vertex = createAiProviderFromEnv({
      AI_PROVIDER: 'vertex',
      GCP_PROJECT_ID: 'aklapper-prod',
    });
    expect(vertex.kind).toBe('vertex');
  });
});
