import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

import { reserveLoopbackPort } from '@aklapper/tooling/e2e';
import { resolveAdminDatabaseUrl } from '@aklapper/tooling/pg';

export const DEFAULT_E2E_ADMIN_INTERNAL_AUTH_SECRET = 'admin-e2e-internal-auth-secret-not-for-prod';
export const DEFAULT_E2E_INTERNAL_AUTH_SECRET = 'e2e-internal-auth-secret-local-only';
export const DEFAULT_E2E_TOTP_ENCRYPTION_KEY = 'e2e-totp-encryption-key-local-only';
export const DEFAULT_E2E_ANALYTICS_DAILY_SALT = 'admin-e2e-analytics-daily-salt';
export const DEFAULT_E2E_DOSSIER_DENYLIST_B64 = Buffer.from(
  JSON.stringify(['SyntheticConfidentialClientX']),
  'utf8',
).toString('base64');

const REPO_ROOT = resolve(import.meta.dirname, '..', '..', '..', '..');
const ADMIN_APP_DIR = resolve(REPO_ROOT, 'apps', 'admin', 'admin');
const ADMIN_API_APP_DIR = resolve(REPO_ROOT, 'apis', 'go', 'admin-api', 'admin-api');

const ADMIN_SSR_STRIPPED_ENV_KEYS = [
  'DATABASE_URL',
  'TEST_DATABASE_URL',
  'E2E_DATABASE_URL',
  'PORTAL_DATABASE_URL',
  'ADMIN_DATABASE_URL',
  'TOTP_ENCRYPTION_KEY',
  'ANALYTICS_DAILY_SALT',
  'DOSSIER_PRIVACY_DENYLIST',
  'QDRANT_API_KEY',
  'QDRANT_URL',
  'AGENSI_API_KEY',
  'AGENSI_API_BASE_URL',
  'AGENSI_API_PATH',
  'AGENSI_CREATOR_HANDLE',
  'AGENSI_SYNC_DISABLED',
  'AGENSI_CACHE_TTL_SECONDS',
  'AGENSI_FETCH_TIMEOUT_MS',
  'WEBAUTHN_RP_ID',
  'WEBAUTHN_RP_NAME',
  'WEBAUTHN_ORIGIN',
] as const;

let tempBuildDir: string | null = null;
let cachedBinaryPath: string | null = null;

function compileAdminApiBinary(): string {
  if (cachedBinaryPath && existsSync(cachedBinaryPath)) {
    return cachedBinaryPath;
  }
  if (!tempBuildDir) {
    tempBuildDir = mkdtempSync(join(tmpdir(), 'aklapper-admin-e2e-go-'));
    const dirToClean = tempBuildDir;
    process.once('exit', () => {
      try {
        rmSync(dirToClean, { recursive: true, force: true });
      } catch {
        // Best-effort cleanup of temp compiled Go binary.
      }
    });
  }
  const outPath = join(tempBuildDir, 'admin-api');
  execFileSync('go', ['build', '-o', outPath, '.'], {
    cwd: ADMIN_API_APP_DIR,
    stdio: 'inherit',
  });
  cachedBinaryPath = outPath;
  return outPath;
}

function resolveVerifiedAdminDatabaseUrl(): string {
  const dsn = resolveAdminDatabaseUrl(process.env);
  if (!dsn) {
    throw new Error(
      'ADMIN_DATABASE_URL (or DATABASE_URL to derive admin_app DSN) must be set before starting admin-api in admin-e2e.',
    );
  }
  const parsed = new URL(dsn);
  const username = decodeURIComponent(parsed.username);
  if (username !== 'admin_app') {
    throw new Error(
      `admin-api E2E harness must authenticate as least-privilege role "admin_app" (got "${username || '<empty>'}").`,
    );
  }
  return dsn;
}

function buildSanitizedAdminSsrEnv(
  overrides: Readonly<Record<string, string | undefined>>,
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const key of ADMIN_SSR_STRIPPED_ENV_KEYS) {
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

function ensureAdminProductionBuild(): void {
  if (existsSync(resolve(ADMIN_APP_DIR, 'dist/server/index.js'))) {
    return;
  }
  execFileSync('pnpm', ['exec', 'react-router', 'build', '--mode', 'production'], {
    cwd: ADMIN_APP_DIR,
    env: buildSanitizedAdminSsrEnv({}),
    stdio: 'inherit',
  });
}

async function terminateProcess(child: ChildProcess, timeoutMs = 4_000): Promise<void> {
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

async function pollServiceHealth(
  baseUrl: string,
  child: ChildProcess,
  timeoutMs: number,
  logs: readonly string[],
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(
        `admin-api exited early with code=${String(child.exitCode)}\n${logs.join('')}`,
      );
    }
    try {
      const res = await fetch(`${baseUrl}/healthz`);
      if (res.ok) return;
    } catch {
      // Wait for socket listen.
    }
    await delay(50);
  }
  throw new Error(
    `Timed out waiting for ${baseUrl}/healthz after ${timeoutMs}ms\n${logs.join('')}`,
  );
}

export interface RunningAdminApiService {
  readonly baseUrl: string;
  readonly port: number;
  readonly close: () => Promise<void>;
}

export async function startAdminApiService(options: {
  readonly adminPort: number;
  readonly adminSecret: string;
  readonly internalSecret: string;
  readonly inheritStdio?: boolean;
}): Promise<RunningAdminApiService> {
  const binPath = compileAdminApiBinary();
  const port = await reserveLoopbackPort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const adminDatabaseUrl = resolveVerifiedAdminDatabaseUrl();
  const adminOrigin = `http://localhost:${options.adminPort}`;

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    APP_ENV: 'production',
    PORT: String(port),
    ADMIN_DATABASE_URL: adminDatabaseUrl,
    ADMIN_INTERNAL_AUTH_SECRET: options.adminSecret,
    INTERNAL_AUTH_SECRET: options.internalSecret,
    TOTP_ENCRYPTION_KEY:
      process.env['TOTP_ENCRYPTION_KEY']?.trim() || DEFAULT_E2E_TOTP_ENCRYPTION_KEY,
    ANALYTICS_DAILY_SALT:
      process.env['ANALYTICS_DAILY_SALT']?.trim() || DEFAULT_E2E_ANALYTICS_DAILY_SALT,
    DOSSIER_PRIVACY_DENYLIST:
      process.env['DOSSIER_PRIVACY_DENYLIST']?.trim() || DEFAULT_E2E_DOSSIER_DENYLIST_B64,
    WEBAUTHN_RP_ID: process.env['WEBAUTHN_RP_ID']?.trim() || 'localhost',
    WEBAUTHN_RP_NAME: process.env['WEBAUTHN_RP_NAME']?.trim() || 'andrew-k.us Admin',
    WEBAUTHN_ORIGIN: process.env['WEBAUTHN_ORIGIN']?.trim() || adminOrigin,
    AGENSI_SYNC_DISABLED: 'true',
  };
  delete env['DATABASE_URL'];
  delete env['PORTAL_DATABASE_URL'];

  const logs: string[] = [];
  const child = spawn(binPath, [], {
    cwd: ADMIN_API_APP_DIR,
    env,
    stdio: options.inheritStdio ? 'inherit' : ['ignore', 'pipe', 'pipe'],
  });
  if (!options.inheritStdio) {
    child.stdout?.on('data', (chunk: Buffer) => logs.push(chunk.toString('utf8')));
    child.stderr?.on('data', (chunk: Buffer) => logs.push(chunk.toString('utf8')));
  }

  try {
    await pollServiceHealth(baseUrl, child, 20_000, logs);
  } catch (err) {
    await terminateProcess(child);
    throw err;
  }

  return {
    baseUrl,
    port,
    close: () => terminateProcess(child),
  };
}

async function runServeAdminSupervisor(): Promise<void> {
  const parsedPort = Number(process.env['ADMIN_PORT'] ?? process.env['PORT'] ?? 4301);
  const adminPort = Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 4301;
  const adminSecret =
    process.env['ADMIN_INTERNAL_AUTH_SECRET']?.trim() || DEFAULT_E2E_ADMIN_INTERNAL_AUTH_SECRET;
  const internalSecret =
    process.env['INTERNAL_AUTH_SECRET']?.trim() || DEFAULT_E2E_INTERNAL_AUTH_SECRET;

  ensureAdminProductionBuild();

  let adminApi: RunningAdminApiService | null = null;
  let adminSsrChild: ChildProcess | null = null;
  let cleaningUp = false;

  const cleanup = async () => {
    if (cleaningUp) return;
    cleaningUp = true;
    await Promise.allSettled([
      adminSsrChild ? terminateProcess(adminSsrChild) : Promise.resolve(),
      adminApi ? adminApi.close() : Promise.resolve(),
    ]);
  };

  process.once('SIGTERM', () => {
    void cleanup().finally(() => process.exit(0));
  });
  process.once('SIGINT', () => {
    void cleanup().finally(() => process.exit(0));
  });

  try {
    adminApi = await startAdminApiService({
      adminPort,
      adminSecret,
      internalSecret,
      inheritStdio: true,
    });

    adminSsrChild = spawn(process.execPath, ['--conditions=@aklapper/source', './src/server.ts'], {
      cwd: ADMIN_APP_DIR,
      env: buildSanitizedAdminSsrEnv({
        NODE_ENV: 'production',
        HOST: '0.0.0.0',
        PORT: String(adminPort),
        ADMIN_PORT: String(adminPort),
        ADMIN_API_URL: adminApi.baseUrl,
        ADMIN_INTERNAL_AUTH_SECRET: adminSecret,
        INTERNAL_AUTH_SECRET: internalSecret,
      }),
      stdio: 'inherit',
    });

    await new Promise<void>(resolveExit => {
      adminSsrChild?.once('exit', code => {
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

if (import.meta.main && process.argv.includes('--serve-admin')) {
  await runServeAdminSupervisor();
}
