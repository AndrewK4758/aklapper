import { execFile, spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { promisify } from 'node:util';

import { findWorkspaceRoot } from '@aklapper/node-runtime/env';

import { reserveLoopbackPort } from './e2e.ts';

const execFileAsync = promisify(execFile);

const DEFAULT_PG_IMAGE = 'postgres:19-alpine';
const DEFAULT_PG_USER = 'postgres';
const DEFAULT_PG_PASSWORD = 'postgres';
const DEFAULT_STARTUP_TIMEOUT_MS = 45_000;

export interface StartEphemeralPostgresOptions {
  /** Short identifier included in container name and Docker labels (e.g. 'test' or 'e2e'). */
  label?: string;
  /** Database name created inside the ephemeral container (defaults to `aklapper_<label>`). */
  dbName?: string;
  /** Docker image to run (defaults to `AKLAPPER_PG_TEST_IMAGE` or `postgres:19-alpine`). */
  image?: string;
  /** Maximum time to wait for Postgres TCP readiness in ms (defaults to 45000). */
  startupTimeoutMs?: number;
}

export interface EphemeralPostgresHandle {
  readonly containerName: string;
  readonly databaseUrl: string;
  readonly portalDatabaseUrl: string;
  readonly adminDatabaseUrl: string;
  readonly dbName: string;
  readonly port: number;
  stop: () => Promise<void>;
}

interface RoleDatabaseUrlSpec {
  readonly urlEnvVar: string;
  readonly passwordEnvVar: string;
  readonly roleUser: string;
  readonly defaultPassword: string;
}

const PORTAL_DB_URL_SPEC: RoleDatabaseUrlSpec = {
  urlEnvVar: 'PORTAL_DATABASE_URL',
  passwordEnvVar: 'PORTAL_APP_PASSWORD',
  roleUser: 'portal_app',
  defaultPassword: 'portal_app_local_dev_password',
};

const ADMIN_DB_URL_SPEC: RoleDatabaseUrlSpec = {
  urlEnvVar: 'ADMIN_DATABASE_URL',
  passwordEnvVar: 'ADMIN_APP_PASSWORD',
  roleUser: 'admin_app',
  defaultPassword: 'admin_app_local_dev_password',
};

function deriveRoleDatabaseUrl(
  databaseUrl: string,
  spec: RoleDatabaseUrlSpec,
  password = spec.defaultPassword,
): string {
  const trimmedUrl = databaseUrl.trim();
  if (!trimmedUrl) {
    throw new Error(`DATABASE_URL is required to derive ${spec.urlEnvVar}`);
  }
  const trimmedPassword = password.trim();
  if (!trimmedPassword) {
    throw new Error(`A non-empty password is required to derive ${spec.urlEnvVar}`);
  }
  const parsed = new URL(trimmedUrl);
  parsed.username = spec.roleUser;
  parsed.password = trimmedPassword;
  return parsed.toString();
}

function resolveRoleDatabaseUrl(
  spec: RoleDatabaseUrlSpec,
  env: Readonly<Record<string, string | undefined>>,
): string | undefined {
  const explicit = env[spec.urlEnvVar]?.trim();
  if (explicit) return explicit;
  const baseUrl = env['DATABASE_URL']?.trim();
  if (!baseUrl) return undefined;
  return deriveRoleDatabaseUrl(
    baseUrl,
    spec,
    env[spec.passwordEnvVar]?.trim() || spec.defaultPassword,
  );
}

/** Builds a least-privilege `PORTAL_DATABASE_URL` substituting role `portal_app`. */
export function derivePortalDatabaseUrl(databaseUrl: string, password?: string): string {
  return deriveRoleDatabaseUrl(databaseUrl, PORTAL_DB_URL_SPEC, password);
}

export function resolvePortalDatabaseUrl(
  env: Readonly<Record<string, string | undefined>> = process.env,
): string | undefined {
  return resolveRoleDatabaseUrl(PORTAL_DB_URL_SPEC, env);
}

/** Builds a least-privilege `ADMIN_DATABASE_URL` substituting role `admin_app`. */
export function deriveAdminDatabaseUrl(databaseUrl: string, password?: string): string {
  return deriveRoleDatabaseUrl(databaseUrl, ADMIN_DB_URL_SPEC, password);
}

export function resolveAdminDatabaseUrl(
  env: Readonly<Record<string, string | undefined>> = process.env,
): string | undefined {
  return resolveRoleDatabaseUrl(ADMIN_DB_URL_SPEC, env);
}

function sanitizeIdentifier(value: string, fallback: string): string {
  const cleaned = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return cleaned.length > 0 ? cleaned : fallback;
}

function sanitizeContainerToken(value: string, fallback: string): string {
  const cleaned = value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned.length > 0 ? cleaned : fallback;
}

export function shouldReuseExternalDatabase(
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  const dbUrl = env['DATABASE_URL']?.trim();
  if (!dbUrl) {
    return false;
  }
  if (env['AKLAPPER_EPHEMERAL_PG_ACTIVE'] === '1') {
    return true;
  }
  if (env['AKLAPPER_EXTERNAL_TEST_DB'] === '1') {
    return true;
  }
  const ciFlag = env['CI']?.trim().toLowerCase();
  return ciFlag === 'true' || ciFlag === '1';
}

async function runDocker(args: readonly string[]): Promise<{ stdout: string; stderr: string }> {
  try {
    return await execFileAsync('docker', [...args], {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch (error) {
    const err = error as NodeJS.ErrnoException & { stdout?: string; stderr?: string };
    const detail = [err.stderr?.trim(), err.stdout?.trim(), err.message].filter(Boolean).join('\n');
    throw new Error(`docker ${args.join(' ')} failed:\n${detail}`);
  }
}

async function removeContainerBestEffort(containerName: string): Promise<void> {
  try {
    await execFileAsync('docker', ['rm', '-f', containerName], {
      encoding: 'utf8',
      timeout: 15_000,
    });
  } catch {
    // Container may already be stopped/removed by --rm or an earlier cleanup call.
  }
}

async function readContainerLogsBestEffort(containerName: string): Promise<string> {
  try {
    const { stdout, stderr } = await execFileAsync('docker', ['logs', containerName], {
      encoding: 'utf8',
      timeout: 5_000,
    });
    return [stdout.trim(), stderr.trim()].filter(Boolean).join('\n');
  } catch {
    return '';
  }
}

async function isContainerRunning(containerName: string): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync(
      'docker',
      ['inspect', '-f', '{{.State.Running}}', containerName],
      { encoding: 'utf8', timeout: 5_000 },
    );
    return stdout.trim() === 'true';
  } catch {
    return false;
  }
}

async function waitForPostgresTcpReady(
  containerName: string,
  dbName: string,
  startupTimeoutMs: number,
): Promise<void> {
  const deadline = Date.now() + startupTimeoutMs;
  let lastError = '';

  while (Date.now() < deadline) {
    try {
      await execFileAsync(
        'docker',
        [
          'exec',
          containerName,
          'psql',
          '-h',
          '127.0.0.1',
          '-p',
          '5432',
          '-U',
          DEFAULT_PG_USER,
          '-d',
          dbName,
          '-tAc',
          'SELECT 1',
        ],
        { encoding: 'utf8', timeout: 5_000 },
      );
      return;
    } catch (error) {
      const err = error as NodeJS.ErrnoException & { stderr?: string };
      lastError = err.stderr?.trim() || err.message;
      const running = await isContainerRunning(containerName);
      if (!running) {
        const logs = await readContainerLogsBestEffort(containerName);
        throw new Error(
          `Ephemeral Postgres container "${containerName}" exited before becoming ready.\nLast check error: ${lastError}\nContainer logs:\n${logs}`,
        );
      }
    }
    await delay(200);
  }

  const logs = await readContainerLogsBestEffort(containerName);
  throw new Error(
    `Ephemeral Postgres container "${containerName}" did not become TCP-ready within ${startupTimeoutMs}ms.\nLast check error: ${lastError}\nContainer logs:\n${logs}`,
  );
}

export async function startEphemeralPostgres(
  options: StartEphemeralPostgresOptions = {},
): Promise<EphemeralPostgresHandle> {
  const labelToken = sanitizeContainerToken(options.label ?? 'test', 'test');
  const dbName = sanitizeIdentifier(options.dbName ?? `aklapper_${labelToken}`, 'aklapper_test');
  const image = options.image ?? process.env['AKLAPPER_PG_TEST_IMAGE']?.trim() ?? DEFAULT_PG_IMAGE;
  const startupTimeoutMs = options.startupTimeoutMs ?? DEFAULT_STARTUP_TIMEOUT_MS;
  const port = await reserveLoopbackPort();
  const suffix = randomBytes(4).toString('hex');
  const containerName = `aklapper-pg19-${labelToken}-${process.pid}-${suffix}`;

  await runDocker([
    'run',
    '--rm',
    '-d',
    '--name',
    containerName,
    '--label',
    'aklapper.ephemeral=true',
    '--label',
    `aklapper.ephemeral.kind=${labelToken}`,
    '-e',
    `POSTGRES_USER=${DEFAULT_PG_USER}`,
    '-e',
    `POSTGRES_PASSWORD=${DEFAULT_PG_PASSWORD}`,
    '-e',
    `POSTGRES_DB=${dbName}`,
    '-p',
    `127.0.0.1:${port}:5432`,
    '--mount',
    'type=tmpfs,destination=/var/lib/postgresql',
    image,
    '-c',
    'fsync=off',
    '-c',
    'synchronous_commit=off',
    '-c',
    'full_page_writes=off',
  ]);

  let stopped = false;
  const stop = async (): Promise<void> => {
    if (stopped) {
      return;
    }
    stopped = true;
    await removeContainerBestEffort(containerName);
  };

  try {
    await waitForPostgresTcpReady(containerName, dbName, startupTimeoutMs);
  } catch (error) {
    await stop();
    throw error;
  }

  const databaseUrl = `postgres://${DEFAULT_PG_USER}:${DEFAULT_PG_PASSWORD}@127.0.0.1:${port}/${dbName}?sslmode=disable`;
  const portalPassword = randomBytes(16).toString('hex');
  const portalDatabaseUrl = derivePortalDatabaseUrl(databaseUrl, portalPassword);
  const adminPassword = randomBytes(16).toString('hex');
  const adminDatabaseUrl = deriveAdminDatabaseUrl(databaseUrl, adminPassword);

  return {
    containerName,
    databaseUrl,
    portalDatabaseUrl,
    adminDatabaseUrl,
    dbName,
    port,
    stop,
  };
}

function runNodeScript(
  scriptPath: string,
  cwd: string,
  env: NodeJS.ProcessEnv,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, ['--conditions=@aklapper/source', scriptPath], {
      cwd,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const stdoutChunks: string[] = [];
    const stderrChunks: string[] = [];

    child.stdout.on('data', (chunk: Buffer) => stdoutChunks.push(chunk.toString('utf8')));
    child.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk.toString('utf8')));
    child.on('error', rejectRun);
    child.on('close', (code, signal) => {
      const stdout = stdoutChunks.join('');
      const stderr = stderrChunks.join('');
      if (code === 0) {
        resolveRun({ stdout, stderr });
        return;
      }
      rejectRun(
        new Error(
          `Script ${scriptPath} failed (code=${String(code)}, signal=${String(signal)}).\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`,
        ),
      );
    });
  });
}

export function resolveWorkspaceRootOrThrow(startDir = import.meta.dirname): string {
  const root = findWorkspaceRoot(startDir);
  if (!root) {
    throw new Error(`Unable to locate workspace root (pnpm-workspace.yaml) from ${startDir}`);
  }
  return root;
}

export async function migrateAndSeedPostgres(
  databaseUrl: string,
  workspaceRoot = resolveWorkspaceRootOrThrow(),
  portalDatabaseUrl = derivePortalDatabaseUrl(databaseUrl),
  adminDatabaseUrl = deriveAdminDatabaseUrl(databaseUrl),
): Promise<void> {
  const dbDir = resolve(workspaceRoot, 'packages/node/db');
  const scriptEnv: NodeJS.ProcessEnv = {
    ...process.env,
    DATABASE_URL: databaseUrl,
    PORTAL_DATABASE_URL: portalDatabaseUrl,
    ADMIN_DATABASE_URL: adminDatabaseUrl,
  };

  await runNodeScript(resolve(dbDir, 'src/provision-portal-role.ts'), dbDir, scriptEnv);
  await runNodeScript(resolve(dbDir, 'src/provision-admin-role.ts'), dbDir, scriptEnv);
  await runNodeScript(resolve(dbDir, 'src/migrate.ts'), dbDir, scriptEnv);
  await runNodeScript(resolve(dbDir, 'src/seed.ts'), dbDir, scriptEnv);
}
