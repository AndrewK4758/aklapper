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
  accessToken?: string;
  metadataUrl?: string;
  endpointBaseUrl?: string;
  fetchImpl?: typeof fetch;
}

const DEFAULT_VERTEX_GEMINI_MODEL = 'gemini-2.5-flash';
const DEFAULT_VERTEX_EMBED_MODEL = 'text-embedding-005';
const DEFAULT_GCP_METADATA_TOKEN_URL =
  'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token';
const METADATA_TOKEN_TIMEOUT_MS = 2_000;

async function resolveVertexAccessToken(config: VertexAiConfig): Promise<string> {
  const direct = config.accessToken?.trim() || process.env['GOOGLE_OAUTH_ACCESS_TOKEN']?.trim();
  if (direct) {
    return direct;
  }

  const fetchFn = config.fetchImpl ?? fetch;
  const metadataUrl =
    config.metadataUrl?.trim() ||
    process.env['GCP_METADATA_TOKEN_URL']?.trim() ||
    DEFAULT_GCP_METADATA_TOKEN_URL;

  try {
    const response = await fetchFn(metadataUrl, {
      method: 'GET',
      headers: { 'Metadata-Flavor': 'Google' },
      signal: AbortSignal.timeout(METADATA_TOKEN_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`metadata server responded with status ${response.status}`);
    }
    const payload = (await response.json()) as { access_token?: string };
    const token = payload.access_token?.trim();
    if (!token) {
      throw new Error('metadata server response omitted access_token');
    }
    return token;
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unreachable';
    throw new Error(
      `Vertex AI credentials unavailable for ${config.projectId}/${config.location}: set GOOGLE_OAUTH_ACCESS_TOKEN or run with GCP Workload Identity metadata server (${reason}).`,
      { cause: error },
    );
  }
}

export function createVertexAiProvider(config: VertexAiConfig): AiProvider {
  const geminiModel = config.geminiModel?.trim() || DEFAULT_VERTEX_GEMINI_MODEL;
  const embedModel = config.embedModel?.trim() || DEFAULT_VERTEX_EMBED_MODEL;
  const fetchFn = config.fetchImpl ?? fetch;
  const baseUrl = (
    config.endpointBaseUrl?.trim() || `https://${config.location}-aiplatform.googleapis.com`
  ).replace(/\/$/, '');

  return {
    kind: 'vertex',
    async generateText(input) {
      const token = await resolveVertexAccessToken(config);
      const url = `${baseUrl}/v1/projects/${encodeURIComponent(config.projectId)}/locations/${encodeURIComponent(config.location)}/publishers/google/models/${encodeURIComponent(geminiModel)}:generateContent`;

      const body: Record<string, unknown> = {
        contents: [{ role: 'user', parts: [{ text: input.prompt }] }],
        generationConfig: {
          maxOutputTokens: input.maxTokens ?? 1024,
          temperature: 0.2,
        },
      };
      if (input.systemPrompt?.trim()) {
        body['systemInstruction'] = {
          parts: [{ text: input.systemPrompt.trim() }],
        };
      }

      const response = await fetchFn(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(
          `Vertex AI generateContent failed for ${config.projectId}/${config.location} with status ${response.status}`,
        );
      }

      const data = (await response.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        usageMetadata?: {
          promptTokenCount?: number;
          candidatesTokenCount?: number;
        };
      };

      const parts = data.candidates?.[0]?.content?.parts ?? [];
      const text = parts
        .map(part => part.text ?? '')
        .join('')
        .trim();

      return {
        text,
        model: geminiModel,
        tokensIn: data.usageMetadata?.promptTokenCount ?? 0,
        tokensOut: data.usageMetadata?.candidatesTokenCount ?? 0,
      };
    },
    async embed(texts) {
      if (texts.length === 0) return [];
      const token = await resolveVertexAccessToken(config);
      const url = `${baseUrl}/v1/projects/${encodeURIComponent(config.projectId)}/locations/${encodeURIComponent(config.location)}/publishers/google/models/${encodeURIComponent(embedModel)}:predict`;

      const response = await fetchFn(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          instances: texts.map(content => ({ content })),
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Vertex AI embeddings predict failed for ${config.projectId}/${config.location} with status ${response.status}`,
        );
      }

      const data = (await response.json()) as {
        predictions?: Array<{ embeddings?: { values?: number[] } }>;
      };

      return (data.predictions ?? []).map(item => item.embeddings?.values ?? []);
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
      accessToken: env['GOOGLE_OAUTH_ACCESS_TOKEN'],
      metadataUrl: env['GCP_METADATA_TOKEN_URL'],
    });
  }
  return createLocalAiProvider({
    baseUrl: env['LOCAL_LLM_BASE_URL'] ?? env['LOCAL_AI_BASE_URL'],
    chatModel: env['LOCAL_LLM_CHAT_MODEL'] ?? env['LOCAL_CHAT_MODEL'],
    embedModel: env['LOCAL_LLM_EMBED_MODEL'] ?? env['LOCAL_EMBED_MODEL'],
  });
}
