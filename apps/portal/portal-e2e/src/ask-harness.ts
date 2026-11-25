import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

import { fetchJson, reserveLoopbackPort, type RunningNodeApi } from '@aklapper/tooling/e2e';

const DEFAULT_E2E_INTERNAL_AUTH_SECRET = 'portal-e2e-internal-auth-secret-not-for-prod';
const VECTOR_DIMS = 768;
const REPO_ROOT = resolve(import.meta.dirname, '..', '..', '..', '..');
const PORTAL_APP_DIR = resolve(REPO_ROOT, 'apps', 'portal', 'portal');
const AI_ASK_APP_DIR = resolve(REPO_ROOT, 'apis', 'go', 'ai-ask', 'ai-ask');

interface StoredVectorPoint {
  readonly id: string;
  readonly vector: readonly number[];
  readonly payload: Readonly<Record<string, unknown>>;
}

export interface RunningMockAiAndQdrant {
  readonly baseUrl: string;
  readonly close: () => Promise<void>;
}

function buildEmbeddingVector(input: string): number[] {
  const lower = input.toLowerCase();
  const isUnrelated =
    lower.includes('xylophone') ||
    lower.includes('underwater') ||
    lower.includes('flamingo') ||
    lower.includes('quantum soup') ||
    lower.includes('unrelated medical');
  const vec = Array.from({ length: VECTOR_DIMS }, () => 0.01);
  if (isUnrelated) {
    vec[0] = 0.02;
    vec[1] = 0.99;
  } else {
    vec[0] = 0.99;
    vec[1] = 0.02;
  }
  return vec;
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {};
  return JSON.parse(raw) as Record<string, unknown>;
}

function writeJsonResponse(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

export async function startMockAiAndQdrantServer(): Promise<RunningMockAiAndQdrant> {
  const port = await reserveLoopbackPort();
  const points = new Map<string, StoredVectorPoint>();

  const server = createServer(async (req, res) => {
    const urlPath = (req.url ?? '/').split('?')[0] ?? '/';
    const method = req.method ?? 'GET';

    if (method === 'GET' && urlPath === '/healthz') {
      writeJsonResponse(res, 200, { status: 'ok' });
      return;
    }

    if (method === 'PUT' && urlPath === '/collections/portfolio_docs') {
      writeJsonResponse(res, 200, { status: 'ok', result: true });
      return;
    }

    if (method === 'GET' && urlPath === '/collections/portfolio_docs') {
      writeJsonResponse(res, 200, {
        status: 'ok',
        result: {
          status: 'green',
          points_count: points.size,
          config: { params: { vectors: { size: VECTOR_DIMS, distance: 'Cosine' } } },
        },
      });
      return;
    }

    if (method === 'PUT' && urlPath === '/collections/portfolio_docs/points') {
      const body = await readJsonBody(req);
      const rawPoints = Array.isArray(body['points']) ? body['points'] : [];
      for (const item of rawPoints) {
        if (!item || typeof item !== 'object') continue;
        const candidate = item as Record<string, unknown>;
        const id = String(candidate['id'] ?? '').trim();
        if (!id) continue;
        points.set(id, {
          id,
          vector: Array.isArray(candidate['vector']) ? (candidate['vector'] as number[]) : [],
          payload:
            candidate['payload'] && typeof candidate['payload'] === 'object'
              ? (candidate['payload'] as Record<string, unknown>)
              : {},
        });
      }
      writeJsonResponse(res, 200, { status: 'ok', result: { status: 'completed' } });
      return;
    }

    if (method === 'POST' && urlPath === '/collections/portfolio_docs/points/scroll') {
      const listed = Array.from(points.values()).map(pt => ({ id: pt.id }));
      writeJsonResponse(res, 200, {
        status: 'ok',
        result: { points: listed, next_page_offset: null },
      });
      return;
    }

    if (method === 'POST' && urlPath === '/collections/portfolio_docs/points/delete') {
      const body = await readJsonBody(req);
      const ids = Array.isArray(body['points']) ? body['points'] : [];
      for (const id of ids) {
        points.delete(String(id));
      }
      writeJsonResponse(res, 200, { status: 'ok', result: { status: 'completed' } });
      return;
    }

    if (method === 'POST' && urlPath === '/collections/portfolio_docs/points/search') {
      const body = await readJsonBody(req);
      const vec = Array.isArray(body['vector']) ? (body['vector'] as number[]) : [];
      const limit = typeof body['limit'] === 'number' && body['limit'] > 0 ? body['limit'] : 4;
      const isLowSimilarity = (vec[1] ?? 0) > 0.5;
      const allPoints = Array.from(points.values()).slice(0, limit);
      const hits = isLowSimilarity
        ? [
            {
              id: allPoints[0]?.id ?? 'low-evidence-1',
              score: 0.21,
              payload: {
                title: 'Unmatched Background Reference',
                snippet: 'No semantic overlap with query topic.',
                category: 'general',
                source: 'curated',
              },
            },
          ]
        : allPoints.map(pt => ({
            id: pt.id,
            score: 0.89,
            payload: pt.payload,
          }));
      writeJsonResponse(res, 200, { status: 'ok', result: hits });
      return;
    }

    if (method === 'POST' && urlPath === '/v1/embeddings') {
      const body = await readJsonBody(req);
      const inputText = typeof body['input'] === 'string' ? body['input'] : '';
      writeJsonResponse(res, 200, {
        data: [{ embedding: buildEmbeddingVector(inputText), index: 0 }],
      });
      return;
    }

    if (method === 'POST' && urlPath === '/v1/chat/completions') {
      const body = await readJsonBody(req);
      const messages = Array.isArray(body['messages']) ? body['messages'] : [];
      const joined = messages
        .map(msg =>
          msg && typeof msg === 'object'
            ? String((msg as Record<string, unknown>)['content'] ?? '')
            : '',
        )
        .join('\n');

      if (joined.toLowerCase().includes('delayed cold-start')) {
        await delay(4_500);
      }

      const isJdMatch =
        joined.includes('untrusted_job_description') || joined.includes('matchScore');
      const content = isJdMatch
        ? JSON.stringify({
            answer:
              'Strong grounded alignment across Go microservices, GKE Autopilot, TypeScript streaming React Router SSR, PostgreSQL 19, and Qdrant retrieval.',
            matchScore: 89,
            strengths: [
              'Production Cloud Run SSR paired with Go microservices on GKE Autopilot',
              'Atomic PostgreSQL 19 quota accounting and Qdrant semantic retrieval',
            ],
            gaps: ['No Terraform HCL modules indexed in public portfolio artifacts'],
          })
        : 'Cloud Run serves React Router 8 streaming SSR while Go microservices run on GKE Autopilot backed by PostgreSQL 19 and Qdrant cosine vector retrieval.';

      writeJsonResponse(res, 200, {
        model: 'gemma-4',
        choices: [{ message: { content } }],
        usage: { total_tokens: isJdMatch ? 320 : 240 },
      });
      return;
    }

    writeJsonResponse(res, 404, { error: `Unhandled mock route: ${method} ${urlPath}` });
  });

  await new Promise<void>((resolveListen, rejectListen) => {
    server.once('error', rejectListen);
    server.listen(port, '127.0.0.1', () => resolveListen());
  });

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: async () => {
      await new Promise<void>(resolveClose => server.close(() => resolveClose()));
    },
  };
}

export function signInternalAuthTokenForTest(options: {
  readonly role: 'admin' | 'guest' | 'service';
  readonly subject: string;
  readonly secret: string;
  readonly ttlSeconds?: number;
}): string {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + Math.max(1, options.ttlSeconds ?? 60);
  const payloadB64 = Buffer.from(
    JSON.stringify({ role: options.role, sub: options.subject, iat, exp }),
    'utf8',
  ).toString('base64url');
  const signingInput = `v1.${payloadB64}`;
  const sigB64 = createHmac('sha256', options.secret).update(signingInput).digest('base64url');
  return `${signingInput}.${sigB64}`;
}

export async function startIsolatedPortalWithoutAsk(): Promise<RunningNodeApi> {
  const closedPort = await reserveLoopbackPort();
  const isolatedPort = await reserveLoopbackPort();
  const secret = process.env['INTERNAL_AUTH_SECRET']?.trim() || DEFAULT_E2E_INTERNAL_AUTH_SECRET;
  const baseUrl = `http://127.0.0.1:${isolatedPort}`;
  const child = spawn(process.execPath, ['--conditions=@aklapper/source', './src/server.ts'], {
    cwd: PORTAL_APP_DIR,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      HOST: '127.0.0.1',
      PORT: String(isolatedPort),
      PORTAL_PORT: String(isolatedPort),
      INTERNAL_AUTH_SECRET: secret,
      AI_ASK_URL: `http://127.0.0.1:${closedPort}`,
      PORTAL_MAINTENANCE_MODE: process.env['PORTAL_MAINTENANCE_MODE'] ?? 'false',
    },
    stdio: 'ignore',
  });
  await waitForHealth(baseUrl, child, 25_000);
  return {
    baseUrl,
    port: isolatedPort,
    close: async () => {
      if (child.exitCode !== null || child.signalCode !== null) return;
      child.kill('SIGTERM');
      await delay(100);
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    },
  };
}

async function waitForHealth(baseUrl: string, child: ChildProcess, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(`Process exited early with code=${String(child.exitCode)}`);
    }
    try {
      const res = await fetch(`${baseUrl}/healthz`);
      if (res.ok) return;
    } catch (error) {
      if (error instanceof Error && error.message.includes('EACCES')) throw error;
    }
    await delay(50);
  }
  throw new Error(`Timed out waiting for ${baseUrl}/healthz after ${timeoutMs}ms`);
}

async function runServePortalSupervisor(): Promise<void> {
  const databaseUrl = process.env['DATABASE_URL']?.trim();
  if (!databaseUrl) {
    throw new Error('DATABASE_URL must be set before starting portal-e2e supervisor');
  }
  const secret = process.env['INTERNAL_AUTH_SECRET']?.trim() || DEFAULT_E2E_INTERNAL_AUTH_SECRET;
  const portalPort = Number(process.env['PORTAL_PORT'] ?? process.env['PORT'] ?? 4300);

  if (!existsSync(resolve(PORTAL_APP_DIR, 'dist/server/index.js'))) {
    execFileSync('pnpm', ['exec', 'react-router', 'build', '--mode', 'production'], {
      cwd: PORTAL_APP_DIR,
      stdio: 'inherit',
    });
  }

  const buildDir = mkdtempSync(join(tmpdir(), 'aklapper-portal-e2e-'));
  const aiAskBin = join(buildDir, 'ai-ask');
  execFileSync('go', ['build', '-o', aiAskBin, '.'], {
    cwd: AI_ASK_APP_DIR,
    stdio: 'inherit',
  });

  const mockServer = await startMockAiAndQdrantServer();
  const aiAskPort = await reserveLoopbackPort();
  const aiAskUrl = `http://127.0.0.1:${aiAskPort}`;

  const aiAskChild = spawn(aiAskBin, [], {
    cwd: AI_ASK_APP_DIR,
    env: {
      ...process.env,
      APP_ENV: 'production',
      PORT: String(aiAskPort),
      DATABASE_URL: databaseUrl,
      INTERNAL_AUTH_SECRET: secret,
      AI_PROVIDER: 'local',
      LOCAL_LLM_BASE_URL: `${mockServer.baseUrl}/v1`,
      LOCAL_LLM_CHAT_MODEL: 'gemma-4',
      LOCAL_LLM_EMBED_MODEL: 'embedding',
      QDRANT_URL: mockServer.baseUrl,
    },
    stdio: 'inherit',
  });

  let portalChild: ChildProcess | null = null;
  let cleaningUp = false;
  const cleanup = async () => {
    if (cleaningUp) return;
    cleaningUp = true;
    portalChild?.kill('SIGTERM');
    aiAskChild.kill('SIGTERM');
    await mockServer.close().catch(() => {});
    rmSync(buildDir, { recursive: true, force: true });
  };

  process.once('SIGTERM', () => {
    void cleanup().finally(() => process.exit(0));
  });
  process.once('SIGINT', () => {
    void cleanup().finally(() => process.exit(0));
  });

  try {
    await waitForHealth(aiAskUrl, aiAskChild, 20_000);
    const adminToken = signInternalAuthTokenForTest({
      role: 'admin',
      subject: 'portal-e2e-supervisor',
      secret,
    });
    const reindexRes = await fetchJson<{ indexed: number }>(`${aiAskUrl}/v1/ask/reindex`, {
      method: 'POST',
      headers: { 'x-internal-auth': adminToken },
    });
    if (reindexRes.status !== 200 || reindexRes.data.indexed < 1) {
      throw new Error(
        `Expected initial ai-ask reindex to seed corpus, got ${JSON.stringify(reindexRes)}`,
      );
    }

    portalChild = spawn(process.execPath, ['--conditions=@aklapper/source', './src/server.ts'], {
      cwd: PORTAL_APP_DIR,
      env: {
        ...process.env,
        NODE_ENV: 'production',
        HOST: '127.0.0.1',
        PORT: String(portalPort),
        PORTAL_PORT: String(portalPort),
        INTERNAL_AUTH_SECRET: secret,
        AI_ASK_URL: aiAskUrl,
      },
      stdio: 'inherit',
    });

    await new Promise<void>(resolveExit => {
      portalChild?.once('exit', code => {
        void cleanup().finally(() => {
          process.exitCode = code ?? 0;
          resolveExit();
        });
      });
    });
  } catch (err) {
    await cleanup();
    throw err;
  }
}

if (import.meta.main && process.argv.includes('--serve-portal')) {
  await runServePortalSupervisor();
}
