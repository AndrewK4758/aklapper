import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

import { reserveLoopbackPort, type RunningNodeApi } from '@aklapper/tooling/e2e';
import { resolvePortalDatabaseUrl } from '@aklapper/tooling/pg';

export const DEFAULT_E2E_INTERNAL_AUTH_SECRET = 'portal-e2e-internal-auth-secret-not-for-prod';
export const DEFAULT_E2E_ANALYTICS_DAILY_SALT = 'portal-e2e-analytics-daily-salt';

export const REPO_ROOT = resolve(import.meta.dirname, '..', '..', '..', '..');
export const PORTAL_APP_DIR = resolve(REPO_ROOT, 'apps', 'portal', 'portal');
export const PORTAL_API_APP_DIR = resolve(REPO_ROOT, 'apis', 'go', 'portal-api', 'portal-api');
export const AI_ASK_APP_DIR = resolve(REPO_ROOT, 'apis', 'go', 'ai-ask', 'ai-ask');
export const CADENCE_DEMO_APP_DIR = resolve(
  REPO_ROOT,
  'apis',
  'go',
  'cadence-demo',
  'cadence-demo',
);

const PORTAL_STRIPPED_ENV_KEYS = [
  'DATABASE_URL',
  'TEST_DATABASE_URL',
  'E2E_DATABASE_URL',
  'PORTAL_DATABASE_URL',
  'ANALYTICS_DAILY_SALT',
  'GEOLITE2_DB_DIR',
  'AGENSI_API_BASE_URL',
  'AGENSI_API_PATH',
  'AGENSI_API_KEY',
  'AGENSI_CREATOR_HANDLE',
  'AGENSI_SYNC_DISABLED',
  'AGENSI_CACHE_TTL_SECONDS',
  'AGENSI_FETCH_TIMEOUT_MS',
] as const;

let sharedBinaryDir: string | null = null;
const compiledBinaries = new Map<string, string>();

function ensureSharedBinaryDir(): string {
  if (sharedBinaryDir) {
    return sharedBinaryDir;
  }
  const dir = mkdtempSync(join(tmpdir(), 'aklapper-portal-e2e-go-'));
  sharedBinaryDir = dir;
  process.once('exit', () => {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // Best-effort cleanup of temp compiled Go binaries.
    }
  });
  return dir;
}

export function compileGoServiceBinary(
  serviceName: 'portal-api' | 'ai-ask' | 'cadence-demo',
  appDir: string,
): string {
  const key = `${serviceName}:${appDir}`;
  const cached = compiledBinaries.get(key);
  if (cached && existsSync(cached)) {
    return cached;
  }
  const dir = ensureSharedBinaryDir();
  const outPath = join(dir, serviceName);
  execFileSync('go', ['build', '-o', outPath, '.'], {
    cwd: appDir,
    stdio: 'inherit',
  });
  compiledBinaries.set(key, outPath);
  return outPath;
}

export function resolveE2EPortalDatabaseUrl(): string {
  const portalDatabaseUrl = resolvePortalDatabaseUrl(process.env);
  if (!portalDatabaseUrl) {
    throw new Error(
      'PORTAL_DATABASE_URL (or DATABASE_URL to derive portal_app DSN) must be set before starting portal-api in portal-e2e',
    );
  }
  const parsed = new URL(portalDatabaseUrl);
  const username = decodeURIComponent(parsed.username);
  if (username !== 'portal_app') {
    throw new Error(
      `portal-api E2E harness must authenticate as least-privilege role "portal_app" (got "${username || '<empty>'}")`,
    );
  }
  return portalDatabaseUrl;
}

export function buildSanitizedPortalEnv(
  overrides: Readonly<Record<string, string | undefined>>,
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const key of PORTAL_STRIPPED_ENV_KEYS) {
    delete env[key];
  }
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete env[key];
    } else {
      env[key] = value;
    }
  }
  return env;
}

export function ensurePortalProductionBuild(): void {
  if (existsSync(resolve(PORTAL_APP_DIR, 'dist/server/index.js'))) {
    return;
  }
  execFileSync('pnpm', ['exec', 'react-router', 'build', '--mode', 'production'], {
    cwd: PORTAL_APP_DIR,
    env: buildSanitizedPortalEnv({}),
    stdio: 'inherit',
  });
}

export async function waitForHttpHealth(
  baseUrl: string,
  child: ChildProcess,
  timeoutMs: number,
  logs?: readonly string[],
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      const tail = logs && logs.length > 0 ? `\n${logs.join('')}` : '';
      throw new Error(`Process exited early with code=${String(child.exitCode)}${tail}`);
    }
    try {
      const res = await fetch(`${baseUrl}/healthz`);
      if (res.ok) return;
    } catch (error) {
      if (error instanceof Error && error.message.includes('EACCES')) throw error;
    }
    await delay(50);
  }
  const tail = logs && logs.length > 0 ? `\n${logs.join('')}` : '';
  throw new Error(`Timed out waiting for ${baseUrl}/healthz after ${timeoutMs}ms${tail}`);
}

export async function stopChildGracefully(child: ChildProcess, timeoutMs = 4_000): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }
  child.kill('SIGTERM');
  await new Promise<void>(resolveExit => {
    const timer = setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill('SIGKILL');
      }
      resolveExit();
    }, timeoutMs);
    child.once('exit', () => {
      clearTimeout(timer);
      resolveExit();
    });
  });
}

export interface RunningGoService {
  readonly baseUrl: string;
  readonly port: number;
  readonly child: ChildProcess;
  readonly logs: readonly string[];
  readonly close: () => Promise<void>;
}

export interface StartPortalApiOptions {
  readonly secret?: string;
  readonly portalDatabaseUrl?: string;
  readonly analyticsDailySalt?: string;
  readonly envOverrides?: Readonly<Record<string, string | undefined>>;
  readonly inheritStdio?: boolean;
}

export async function startPortalApiService(
  options: StartPortalApiOptions = {},
): Promise<RunningGoService> {
  const binPath = compileGoServiceBinary('portal-api', PORTAL_API_APP_DIR);
  const port = await reserveLoopbackPort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const secret =
    options.secret ??
    (process.env['INTERNAL_AUTH_SECRET']?.trim() || DEFAULT_E2E_INTERNAL_AUTH_SECRET);
  const portalDatabaseUrl = options.portalDatabaseUrl ?? resolveE2EPortalDatabaseUrl();
  const analyticsDailySalt =
    options.analyticsDailySalt ??
    (process.env['ANALYTICS_DAILY_SALT']?.trim() || DEFAULT_E2E_ANALYTICS_DAILY_SALT);

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    APP_ENV: 'production',
    PORT: String(port),
    PORTAL_DATABASE_URL: portalDatabaseUrl,
    INTERNAL_AUTH_SECRET: secret,
    ANALYTICS_DAILY_SALT: analyticsDailySalt,
    ANALYTICS_INGEST_RATE_LIMIT_MAX: process.env['ANALYTICS_INGEST_RATE_LIMIT_MAX'] ?? '1000',
  };
  delete env['DATABASE_URL'];
  if (options.envOverrides) {
    for (const [k, v] of Object.entries(options.envOverrides)) {
      if (v === undefined) delete env[k];
      else env[k] = v;
    }
  }

  const logs: string[] = [];
  const child = spawn(binPath, [], {
    cwd: PORTAL_API_APP_DIR,
    env,
    stdio: options.inheritStdio ? 'inherit' : ['ignore', 'pipe', 'pipe'],
  });
  if (!options.inheritStdio) {
    child.stdout?.on('data', (chunk: Buffer) => logs.push(chunk.toString('utf8')));
    child.stderr?.on('data', (chunk: Buffer) => logs.push(chunk.toString('utf8')));
  }

  try {
    await waitForHttpHealth(baseUrl, child, 20_000, logs);
  } catch (err) {
    await stopChildGracefully(child);
    throw err;
  }

  return {
    baseUrl,
    port,
    child,
    logs,
    close: () => stopChildGracefully(child),
  };
}

export interface StartAiBackendOptions {
  readonly databaseUrl: string;
  readonly mockBaseUrl: string;
  readonly secret: string;
  readonly inheritStdio?: boolean;
}

async function startAiBackedGoService(
  serviceName: 'ai-ask' | 'cadence-demo',
  appDir: string,
  options: StartAiBackendOptions,
): Promise<RunningGoService> {
  const binPath = compileGoServiceBinary(serviceName, appDir);
  const port = await reserveLoopbackPort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const logs: string[] = [];
  const child = spawn(binPath, [], {
    cwd: appDir,
    env: {
      ...process.env,
      APP_ENV: 'production',
      PORT: String(port),
      DATABASE_URL: options.databaseUrl,
      INTERNAL_AUTH_SECRET: options.secret,
      AI_PROVIDER: 'local',
      LOCAL_LLM_BASE_URL: `${options.mockBaseUrl}/v1`,
      LOCAL_LLM_CHAT_MODEL: 'gemma-4',
      LOCAL_LLM_EMBED_MODEL: 'embedding',
      QDRANT_URL: options.mockBaseUrl,
    },
    stdio: options.inheritStdio ? 'inherit' : ['ignore', 'pipe', 'pipe'],
  });
  if (!options.inheritStdio) {
    child.stdout?.on('data', (chunk: Buffer) => logs.push(chunk.toString('utf8')));
    child.stderr?.on('data', (chunk: Buffer) => logs.push(chunk.toString('utf8')));
  }

  try {
    await waitForHttpHealth(baseUrl, child, 20_000, logs);
  } catch (err) {
    await stopChildGracefully(child);
    throw err;
  }

  return {
    baseUrl,
    port,
    child,
    logs,
    close: () => stopChildGracefully(child),
  };
}

export function startAiAskService(options: StartAiBackendOptions): Promise<RunningGoService> {
  return startAiBackedGoService('ai-ask', AI_ASK_APP_DIR, options);
}

export function startCadenceDemoService(options: StartAiBackendOptions): Promise<RunningGoService> {
  return startAiBackedGoService('cadence-demo', CADENCE_DEMO_APP_DIR, options);
}

export interface StartIsolatedPortalOptions {
  readonly portalApiUrl: string;
  readonly aiAskUrl?: string;
  readonly cadenceDemoUrl?: string;
  readonly secret?: string;
  readonly port?: number;
  readonly servePrerenderedStatic?: boolean;
  readonly inheritStdio?: boolean;
}

export async function startIsolatedPortalServer(
  options: StartIsolatedPortalOptions,
): Promise<RunningNodeApi> {
  ensurePortalProductionBuild();
  const port = options.port ?? (await reserveLoopbackPort());
  const baseUrl = `http://127.0.0.1:${port}`;
  const secret =
    options.secret ??
    (process.env['INTERNAL_AUTH_SECRET']?.trim() || DEFAULT_E2E_INTERNAL_AUTH_SECRET);

  const logs: string[] = [];
  const child = spawn(process.execPath, ['--conditions=@aklapper/source', './src/server.ts'], {
    cwd: PORTAL_APP_DIR,
    env: buildSanitizedPortalEnv({
      NODE_ENV: 'production',
      HOST: '127.0.0.1',
      PORTAL_HOST: '127.0.0.1',
      PORT: String(port),
      PORTAL_PORT: String(port),
      INTERNAL_AUTH_SECRET: secret,
      PORTAL_API_URL: options.portalApiUrl,
      AI_ASK_URL: options.aiAskUrl ?? '',
      CADENCE_DEMO_URL: options.cadenceDemoUrl ?? '',
      SERVE_PRERENDERED_STATIC:
        options.servePrerenderedStatic === undefined
          ? undefined
          : String(options.servePrerenderedStatic),
    }),
    stdio: options.inheritStdio ? 'inherit' : ['ignore', 'pipe', 'pipe'],
  });
  if (!options.inheritStdio) {
    child.stdout?.on('data', (chunk: Buffer) => logs.push(chunk.toString('utf8')));
    child.stderr?.on('data', (chunk: Buffer) => logs.push(chunk.toString('utf8')));
  }

  try {
    await waitForHttpHealth(baseUrl, child, 25_000, logs);
  } catch (err) {
    await stopChildGracefully(child);
    throw err;
  }

  return {
    baseUrl,
    port,
    close: () => stopChildGracefully(child),
  };
}
