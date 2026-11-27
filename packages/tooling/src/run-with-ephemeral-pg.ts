import { spawn } from 'node:child_process';

import { reserveLoopbackPort } from './e2e.ts';
import {
  type EphemeralPostgresHandle,
  migrateAndSeedPostgres,
  resolveAdminDatabaseUrl,
  resolvePortalDatabaseUrl,
  resolveWorkspaceRootOrThrow,
  shouldReuseExternalDatabase,
  startEphemeralPostgres,
} from './pg-test-container.ts';

interface ParsedCliArgs {
  label: string;
  command: string;
  args: string[];
}

export function parseEphemeralPgCliArgs(argv: readonly string[]): ParsedCliArgs {
  const separatorIndex = argv.indexOf('--');
  if (separatorIndex === -1 || separatorIndex >= argv.length - 1) {
    throw new Error('Usage: run-with-ephemeral-pg.ts [--label <test|e2e>] -- <command> [args...]');
  }

  let label = 'test';
  for (let i = 0; i < separatorIndex; i += 1) {
    const token = argv[i];
    if (token === '--label') {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) {
        throw new Error('Expected a value after --label');
      }
      label = value;
      i += 1;
    } else if (token?.startsWith('--label=')) {
      label = token.slice('--label='.length);
    } else {
      throw new Error(`Unknown option before "--": ${String(token)}`);
    }
  }

  const command = argv[separatorIndex + 1];
  if (!command) {
    throw new Error('Missing command after "--"');
  }
  return {
    label,
    command,
    args: argv.slice(separatorIndex + 2),
  };
}

function runCommandWithEnv(
  command: string,
  args: readonly string[],
  env: NodeJS.ProcessEnv,
  onSignalCleanup?: () => Promise<void>,
): Promise<number> {
  return new Promise((resolveExit, rejectExit) => {
    const child = spawn(command, [...args], {
      cwd: process.cwd(),
      env,
      stdio: 'inherit',
    });

    let signalHandled = false;
    const handleSignal = (signal: NodeJS.Signals): void => {
      if (signalHandled) {
        return;
      }
      signalHandled = true;
      if (child.exitCode === null && child.signalCode === null) {
        child.kill(signal);
      }
      const exitCode = signal === 'SIGINT' ? 130 : 143;
      void (async () => {
        if (onSignalCleanup) {
          await onSignalCleanup();
        }
        process.exit(exitCode);
      })();
    };

    process.on('SIGINT', handleSignal);
    process.on('SIGTERM', handleSignal);

    const cleanupListeners = (): void => {
      process.off('SIGINT', handleSignal);
      process.off('SIGTERM', handleSignal);
    };

    child.on('error', error => {
      cleanupListeners();
      rejectExit(error);
    });

    child.on('close', (code, signal) => {
      cleanupListeners();
      if (signal) {
        resolveExit(signal === 'SIGINT' ? 130 : 143);
        return;
      }
      resolveExit(code ?? 1);
    });
  });
}

export function buildExternalPgChildEnv(
  env: Readonly<Record<string, string | undefined>> = process.env,
): NodeJS.ProcessEnv {
  const nextEnv: NodeJS.ProcessEnv = { ...env };
  if (!env['PORTAL_DATABASE_URL']?.trim()) {
    const resolvedPortalUrl = resolvePortalDatabaseUrl(env);
    if (resolvedPortalUrl) {
      nextEnv['PORTAL_DATABASE_URL'] = resolvedPortalUrl;
    }
  }
  if (!env['ADMIN_DATABASE_URL']?.trim()) {
    const resolvedAdminUrl = resolveAdminDatabaseUrl(env);
    if (resolvedAdminUrl) {
      nextEnv['ADMIN_DATABASE_URL'] = resolvedAdminUrl;
    }
  }
  return nextEnv;
}

async function main(): Promise<void> {
  const { label, command, args } = parseEphemeralPgCliArgs(process.argv.slice(2));

  if (shouldReuseExternalDatabase(process.env)) {
    const exitCode = await runCommandWithEnv(command, args, buildExternalPgChildEnv(process.env));
    process.exit(exitCode);
  }

  const workspaceRoot = resolveWorkspaceRootOrThrow();
  let handle: EphemeralPostgresHandle | null = null;

  const stopContainer = async (): Promise<void> => {
    if (!handle) {
      return;
    }
    const current = handle;
    handle = null;
    await current.stop();
    console.error(`[ephemeral-pg:${label}] removed ${current.containerName}`);
  };

  try {
    handle = await startEphemeralPostgres({ label });
    console.error(
      `[ephemeral-pg:${label}] started ${handle.containerName} on 127.0.0.1:${handle.port}/${handle.dbName} (tmpfs)`,
    );

    await migrateAndSeedPostgres(
      handle.databaseUrl,
      workspaceRoot,
      handle.portalDatabaseUrl,
      handle.adminDatabaseUrl,
    );
    console.error(`[ephemeral-pg:${label}] migrations and seed complete`);

    const childEnv: NodeJS.ProcessEnv = {
      ...process.env,
      DATABASE_URL: handle.databaseUrl,
      TEST_DATABASE_URL: handle.databaseUrl,
      E2E_DATABASE_URL: handle.databaseUrl,
      PORTAL_DATABASE_URL: handle.portalDatabaseUrl,
      ADMIN_DATABASE_URL: handle.adminDatabaseUrl,
      AKLAPPER_EPHEMERAL_PG_ACTIVE: '1',
    };

    if (label === 'e2e') {
      if (!childEnv['PORTAL_BASE_URL'] && !childEnv['PORTAL_PORT']) {
        childEnv['PORTAL_PORT'] = String(await reserveLoopbackPort());
      }
      if (!childEnv['ADMIN_BASE_URL'] && !childEnv['ADMIN_PORT']) {
        childEnv['ADMIN_PORT'] = String(await reserveLoopbackPort());
      }
    }

    const exitCode = await runCommandWithEnv(command, args, childEnv, stopContainer);
    await stopContainer();
    process.exit(exitCode);
  } catch (error) {
    await stopContainer();
    throw error;
  }
}

if (import.meta.main) {
  await main();
}
