import { execFileSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

import type { CareerDossierUpsertInput, PrivacySanitizationFinding } from '@aklapper/core';
import { PrivacySanitizationFindingSchema } from '@aklapper/core';
import { z } from 'zod';

export type { PrivacySanitizationFinding };

const DEFAULT_CONTAINER_PRIVACY_BIN = '/usr/local/bin/privacy-check';
const MAX_CLI_BUFFER_BYTES = 8 * 1024 * 1024;

let cachedBuiltBinaryPath: string | null = null;

export interface GoPrivacyCheckField {
  readonly field: string;
  readonly text: string;
}

export interface GoPrivacyCheckRequest {
  readonly mode: 'site_content' | 'career_dossier' | 'text' | 'parse_denylist';
  readonly surface?: string;
  readonly fields?: readonly GoPrivacyCheckField[];
  readonly markdownBody?: string;
  readonly metadata?: Record<string, unknown>;
  readonly dossier?: CareerDossierUpsertInput;
  readonly rawDenylist?: string;
  readonly denylistFileContent?: string;
  readonly requireConfiguredDenylist?: boolean;
  readonly correlationId?: string;
}

export interface GoPrivacyCheckResponse {
  readonly passed: boolean;
  readonly denylistConfigured: boolean;
  readonly denylistHash: string;
  readonly findings: readonly PrivacySanitizationFinding[];
}

export interface GoPrivacyCliOptions {
  readonly env?: Record<string, string | undefined>;
  readonly cwd?: string;
}

export interface GoPrivacySanitizeOptions extends GoPrivacyCliOptions {
  readonly requireConfiguredDenylist?: boolean;
  readonly rawDenylist?: string;
  readonly correlationId?: string;
}

export interface GoPrivacyDossierResult {
  readonly denylistHash: string;
  readonly verifiedAt: Date;
}

export class PrivacySanitizationError extends Error {
  readonly code = 'ERR_CONSTRAINT' as const;
  readonly status = 422 as const;
  readonly findings: readonly PrivacySanitizationFinding[];

  constructor(findings: readonly PrivacySanitizationFinding[]) {
    super('Content failed privacy sanitization policy.');
    this.name = 'PrivacySanitizationError';
    this.findings = findings.map(finding => ({
      ruleId: finding.ruleId,
      category: finding.category,
      field: finding.field,
      location: finding.location,
    }));
  }
}

const GoPrivacyCheckResponseSchema = z.object({
  passed: z.boolean(),
  denylistConfigured: z.boolean(),
  denylistHash: z.string().min(1),
  findings: z.array(PrivacySanitizationFindingSchema),
});

export function isProductionPrivacyEnv(
  env: Record<string, string | undefined> = process.env,
): boolean {
  const nodeEnv = env['NODE_ENV']?.trim().toLowerCase();
  const appEnv = env['APP_ENV']?.trim().toLowerCase();
  return nodeEnv === 'production' || appEnv === 'production';
}

function emitPrivacyCliFailedSeam(reason: string, mode: string, exitCode?: number): void {
  console.error(
    JSON.stringify({
      seam_type: 'BOUNDARY_FAULT',
      event: 'db_migrate.privacy_cli.failed',
      mode,
      reason,
      ...(exitCode !== undefined ? { exitCode } : {}),
    }),
  );
}

function findGoKitDirectory(startDir: string): string | null {
  let cursor = resolve(startDir);
  for (let depth = 0; depth < 8; depth += 1) {
    const candidate = join(cursor, 'packages', 'go', 'kit');
    if (existsSync(join(candidate, 'cmd', 'privacy-check', 'main.go'))) {
      return candidate;
    }
    const parent = dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }
  return null;
}

function resolvePrivacyCheckBinary(
  env: Record<string, string | undefined>,
  cwd?: string,
): { readonly command: string; readonly args: readonly string[]; readonly execCwd?: string } {
  const explicitBin = env['PRIVACY_CHECK_BIN']?.trim();
  if (explicitBin) {
    return { command: explicitBin, args: [] };
  }
  if (existsSync(DEFAULT_CONTAINER_PRIVACY_BIN)) {
    return { command: DEFAULT_CONTAINER_PRIVACY_BIN, args: [] };
  }
  if (cachedBuiltBinaryPath && existsSync(cachedBuiltBinaryPath)) {
    return { command: cachedBuiltBinaryPath, args: [] };
  }

  const goKitDir =
    findGoKitDirectory(cwd ?? process.cwd()) ?? findGoKitDirectory(import.meta.dirname);
  if (!goKitDir) {
    throw new Error(
      'Unable to locate privacy-check binary (set PRIVACY_CHECK_BIN or run inside workspace).',
    );
  }

  const tempBin = join(tmpdir(), `aklapper-privacy-check-${process.pid}`);
  try {
    execFileSync('go', ['build', '-o', tempBin, './cmd/privacy-check'], {
      cwd: goKitDir,
      stdio: ['ignore', 'ignore', 'pipe'],
      encoding: 'utf8',
    });
    cachedBuiltBinaryPath = tempBin;
    process.once('exit', () => {
      try {
        rmSync(tempBin, { force: true });
      } catch {
        // ignore temp cleanup failure on exit
      }
    });
    return { command: tempBin, args: [] };
  } catch {
    return {
      command: 'go',
      args: ['run', './cmd/privacy-check'],
      execCwd: goKitDir,
    };
  }
}

function parseCliStdout(rawStdout: string, mode: string): GoPrivacyCheckResponse {
  try {
    const parsed: unknown = JSON.parse(rawStdout.trim());
    return GoPrivacyCheckResponseSchema.parse(parsed);
  } catch {
    emitPrivacyCliFailedSeam('malformed_json_output', mode);
    throw new Error('privacy-check CLI returned malformed JSON output.');
  }
}

export function runGoPrivacyCheck(
  request: GoPrivacyCheckRequest,
  options: GoPrivacyCliOptions = {},
): GoPrivacyCheckResponse {
  const env = options.env ?? process.env;
  let resolved: ReturnType<typeof resolvePrivacyCheckBinary>;
  try {
    resolved = resolvePrivacyCheckBinary(env, options.cwd);
  } catch (error) {
    emitPrivacyCliFailedSeam('binary_not_found', request.mode);
    throw error;
  }

  try {
    const stdout = execFileSync(resolved.command, [...resolved.args], {
      ...(resolved.execCwd ? { cwd: resolved.execCwd } : {}),
      input: JSON.stringify(request),
      encoding: 'utf8',
      maxBuffer: MAX_CLI_BUFFER_BYTES,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return parseCliStdout(stdout, request.mode);
  } catch (error) {
    const err = error as { status?: number | null; stdout?: string | Buffer };
    if (err.status === 1 && err.stdout !== undefined) {
      const stdoutText = typeof err.stdout === 'string' ? err.stdout : err.stdout.toString('utf8');
      return parseCliStdout(stdoutText, request.mode);
    }
    emitPrivacyCliFailedSeam(
      'process_execution_failed',
      request.mode,
      typeof err.status === 'number' ? err.status : undefined,
    );
    throw new Error(
      `privacy-check CLI failed for mode "${request.mode}"${typeof err.status === 'number' ? ` (exit ${err.status})` : ''}.`,
    );
  }
}

export function sanitizeSiteContentViaGoCli(
  key: string,
  markdownBody: string,
  metadata: Record<string, unknown>,
  options: GoPrivacySanitizeOptions = {},
): void {
  const env = options.env ?? process.env;
  const requireConfigured = options.requireConfiguredDenylist ?? isProductionPrivacyEnv(env);
  const res = runGoPrivacyCheck(
    {
      mode: 'site_content',
      surface: `site_content.${key}`,
      markdownBody,
      metadata,
      rawDenylist: options.rawDenylist ?? env['DOSSIER_PRIVACY_DENYLIST'] ?? '',
      requireConfiguredDenylist: requireConfigured,
      ...(options.correlationId ? { correlationId: options.correlationId } : {}),
    },
    { env, cwd: options.cwd },
  );
  if (!res.passed) {
    throw new PrivacySanitizationError(res.findings);
  }
}

export function sanitizeCareerDossierViaGoCli(
  input: CareerDossierUpsertInput,
  options: GoPrivacySanitizeOptions = {},
): GoPrivacyDossierResult {
  const env = options.env ?? process.env;
  const requireConfigured = options.requireConfiguredDenylist ?? false;
  const res = runGoPrivacyCheck(
    {
      mode: 'career_dossier',
      surface: 'career_dossiers',
      dossier: input,
      rawDenylist: options.rawDenylist ?? env['DOSSIER_PRIVACY_DENYLIST'] ?? '',
      requireConfiguredDenylist: requireConfigured,
      ...(options.correlationId ? { correlationId: options.correlationId } : {}),
    },
    { env, cwd: options.cwd },
  );
  if (!res.passed) {
    throw new PrivacySanitizationError(res.findings);
  }
  return {
    denylistHash: res.denylistHash,
    verifiedAt: new Date(),
  };
}
