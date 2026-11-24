import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

export interface LoadWorkspaceEnvOptions {
  /** Starting directory for upward workspace-root discovery (defaults to `process.cwd()`). */
  startDir?: string;
  /** Optional environment mode override (defaults to `APP_ENV ?? NODE_ENV`). */
  mode?: string;
}

const WORKSPACE_MARKERS = ['pnpm-workspace.yaml'] as const;

export function findWorkspaceRoot(startDir = process.cwd()): string | null {
  let current = resolve(startDir);
  while (true) {
    if (WORKSPACE_MARKERS.some(marker => existsSync(join(current, marker)))) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

export function resolveEnvFilePaths(rootDir: string, mode?: string): string[] {
  const trimmedMode = mode?.trim();
  const filenames = [
    ...(trimmedMode ? [`.env.${trimmedMode}.local`, `.env.${trimmedMode}`] : []),
    '.env.local',
    '.env',
  ];
  return filenames.map(name => join(rootDir, name));
}

/**
 * Loads layered workspace `.env` files using Node's native `process.loadEnvFile` without hardcoded
 * relative paths. Existing `process.env` values (shell, CI, Cloud Run) always win, followed by
 * `.env.<mode>.local` > `.env.<mode>` > `.env.local` > `.env`.
 */
export function loadWorkspaceEnv(options: LoadWorkspaceEnvOptions = {}): string[] {
  const rootDir = findWorkspaceRoot(options.startDir);
  if (!rootDir) {
    return [];
  }

  const mode = options.mode ?? process.env['APP_ENV'] ?? process.env['NODE_ENV'];
  const loaded: string[] = [];

  for (const filePath of resolveEnvFilePaths(rootDir, mode)) {
    if (existsSync(filePath)) {
      process.loadEnvFile(filePath);
      loaded.push(filePath);
    }
  }

  return loaded;
}
