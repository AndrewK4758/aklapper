export interface GenerateTextInput {
  systemPrompt?: string;
  prompt: string;
  maxTokens?: number;
}

export interface GenerateTextResult {
  text: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
}

export interface AiProvider {
  readonly kind: 'local' | 'vertex';
  generateText: (input: GenerateTextInput) => Promise<GenerateTextResult>;
  embed: (texts: readonly string[]) => Promise<number[][]>;
}

export interface LocalAiConfig {
  baseUrl?: string;
  chatModel?: string;
  embedModel?: string;
}

export function createLocalAiProvider(config: LocalAiConfig = {}): AiProvider {
  const baseUrl = (
    config.baseUrl ??
    process.env['LOCAL_LLM_BASE_URL'] ??
    process.env['LOCAL_AI_BASE_URL'] ??
    'http://127.0.0.1:11434/v1'
  ).replace(/\/$/, '');
  const chatModel =
    config.chatModel ??
    process.env['LOCAL_LLM_CHAT_MODEL'] ??
    process.env['LOCAL_CHAT_MODEL'] ??
    'inference';
  const embedModel =
    config.embedModel ??
    process.env['LOCAL_LLM_EMBED_MODEL'] ??
    process.env['LOCAL_EMBED_MODEL'] ??
    'embeddinggemma';

  return {
    kind: 'local',
    async generateText(input) {
      const messages = input.systemPrompt
        ? [
            { role: 'system', content: input.systemPrompt },
            { role: 'user', content: input.prompt },
          ]
        : [{ role: 'user', content: input.prompt }];

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: chatModel,
          messages,
          max_tokens: input.maxTokens ?? 1024,
        }),
      });
      if (!response.ok) {
        throw new Error(`Local AI chat request failed with status ${response.status}`);
      }
      const data = (await response.json()) as {
        model?: string;
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      return {
        text: data.choices?.[0]?.message?.content ?? '',
        model: data.model ?? chatModel,
        tokensIn: data.usage?.prompt_tokens ?? 0,
        tokensOut: data.usage?.completion_tokens ?? 0,
      };
    },
    async embed(texts) {
      const response = await fetch(`${baseUrl}/embeddings`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model: embedModel, input: texts }),
      });
      if (!response.ok) {
        throw new Error(`Local AI embed request failed with status ${response.status}`);
      }
      const data = (await response.json()) as { data?: Array<{ embedding: number[] }> };
      return (data.data ?? []).map(item => item.embedding);
    },
  };
}

export interface VertexAiConfig {
  projectId: string;
  location: string;
  geminiModel?: string;
  embedModel?: string;
}

export function createVertexAiProvider(config: VertexAiConfig): AiProvider {
  return {
    kind: 'vertex',
    async generateText() {
      throw new Error(
        `Vertex AI provider (${config.projectId}/${config.location}) is configured for GCP deployment; supply credentials to enable live Gemini calls.`,
      );
    },
    async embed() {
      throw new Error(
        `Vertex AI embeddings (${config.projectId}/${config.location}) require GCP Workload Identity credentials.`,
      );
    },
  };
}

export function createAiProviderFromEnv(env: NodeJS.ProcessEnv = process.env): AiProvider {
  if (env['AI_PROVIDER'] === 'vertex') {
    const projectId = env['GCP_PROJECT_ID'];
    const location = env['GCP_LOCATION'] ?? 'us-central1';
    if (!projectId) {
      throw new Error('GCP_PROJECT_ID is required when AI_PROVIDER=vertex');
    }
    return createVertexAiProvider({
      projectId,
      location,
      geminiModel: env['VERTEX_MODEL'] ?? env['VERTEX_GEMINI_MODEL'],
      embedModel: env['VERTEX_EMBED_MODEL'],
    });
  }
  return createLocalAiProvider({
    baseUrl: env['LOCAL_LLM_BASE_URL'] ?? env['LOCAL_AI_BASE_URL'],
    chatModel: env['LOCAL_LLM_CHAT_MODEL'] ?? env['LOCAL_CHAT_MODEL'],
    embedModel: env['LOCAL_LLM_EMBED_MODEL'] ?? env['LOCAL_EMBED_MODEL'],
  });
}
