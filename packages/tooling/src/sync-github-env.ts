import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  bootstrapGcpWorkloadIdentity,
  GCP_OPTIONAL_SECRET_MANAGER_SECRETS,
  GCP_SECRET_MANAGER_SECRETS,
  type GcpSecretSyncEntry,
  resolveSecretId,
  syncGcpSecretVersions,
} from './sync-gcp-secrets.ts';

export const GITHUB_ENV_SECRETS = [
  'GCP_WORKLOAD_IDENTITY_PROVIDER',
  'GCP_WIF_SERVICE_ACCOUNT',
] as const;

export const GITHUB_OPTIONAL_ENV_SECRETS = [
  'QDRANT_API_KEY',
  'AGENSI_API_KEY',
  'AI_PRIVACY_DENYLIST',
  'DOSSIER_PRIVACY_DENYLIST',
] as const;

export const GITHUB_REQUIRED_ENV_VARS = ['GCP_PROJECT_ID', 'GCP_REGION', 'GAR_REPOSITORY'] as const;

export const GITHUB_OPTIONAL_ENV_VARS = [
  'CLOUD_SQL_INSTANCE',
  'GKE_CLUSTER_NAME',
  'GKE_CLUSTER_LOCATION',
  'PORTAL_MAINTENANCE_MODE',
  'PUBLIC_PORTAL_URL',
  'PUBLIC_ADMIN_URL',
  'PUBLIC_ANALYTICS_ENDPOINT',
  'PUBLIC_GA_MEASUREMENT_ID',
  'PUBLIC_GTM_ID',
  'PUBLIC_GSC_VERIFICATION',
  'WEBAUTHN_RP_ID',
  'WEBAUTHN_RP_NAME',
  'WEBAUTHN_ORIGIN',
  'K8S_WATCH_URL',
  'CADENCE_DEMO_URL',
  'AI_ASK_URL',
  'QDRANT_URL',
  'AGENSI_API_BASE_URL',
  'AGENSI_API_PATH',
  'AGENSI_CREATOR_HANDLE',
  'AGENSI_SYNC_DISABLED',
  'AGENSI_CACHE_TTL_SECONDS',
  'AGENSI_FETCH_TIMEOUT_MS',
  'AI_PROVIDER',
  'GCP_LOCATION',
  'VERTEX_MODEL',
  'VERTEX_THINKING_BUDGET',
  'VERTEX_EMBED_MODEL',
  'ADMIN_HANDLE',
  'GCP_CLOUDRUN_SERVICE_ACCOUNT',
  'GCP_MIGRATOR_SERVICE_ACCOUNT',
  'GCP_GKE_WORKLOAD_SA',
  'CLOUD_RUN_ALLOW_UNAUTH_ADMIN',
] as const;

export type TargetEnvironment = 'production';

export interface ParsedSyncCliArgs {
  readonly env: TargetEnvironment;
  readonly filePath: string;
  readonly repo: string;
  readonly dryRun: boolean;
  readonly bootstrapWif: boolean;
  readonly skipGcpSecrets: boolean;
}

export interface SyncEntry {
  readonly key: string;
  readonly value: string;
}

export interface SyncPlan {
  readonly secrets: readonly SyncEntry[];
  readonly gcpSecrets: readonly GcpSecretSyncEntry[];
  readonly variables: readonly SyncEntry[];
  readonly skippedOptionalSecrets: readonly string[];
  readonly skippedOptionalVariables: readonly string[];
  readonly missingRequired: readonly string[];
  readonly placeholderKeys: readonly string[];
  readonly retiredKeys: readonly string[];
}

const DEFAULT_REPO = 'AndrewK4758/aklapper';
const PLACEHOLDER_PATTERN = /REPLACE_ME|CHANGE_ME|YOUR_[A-Z0-9_]+/i;
const RETIRED_ENV_KEYS = [
  'ADMIN_BOOTSTRAP_TOKEN',
  'AUTH_API_URL',
  'ANALYTICS_API_URL',
  'CADENCE_ADMIN_URL',
  'CONTACT_API_URL',
  'CLOUD_RUN_ALLOW_UNAUTH_APIS',
] as const;

export function parseEnvFileContent(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }
    const eqIndex = line.indexOf('=');
    if (eqIndex <= 0) {
      continue;
    }
    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

function isHttpsUrl(rawUrl: string | undefined): boolean {
  const trimmed = rawUrl?.trim();
  if (!trimmed) return false;
  try {
    return new URL(trimmed).protocol === 'https:';
  } catch {
    return trimmed.toLowerCase().startsWith('https://');
  }
}

function pushUnique(target: string[], key: string): void {
  if (!target.includes(key)) {
    target.push(key);
  }
}

export function buildSyncPlan(values: Readonly<Record<string, string>>): SyncPlan {
  const secrets: SyncEntry[] = [];
  const gcpSecrets: GcpSecretSyncEntry[] = [];
  const variables: SyncEntry[] = [];
  const skippedOptionalSecrets: string[] = [];
  const skippedOptionalVariables: string[] = [];
  const missingRequired: string[] = [];
  const placeholderKeys: string[] = [];
  const retiredKeys = RETIRED_ENV_KEYS.filter(key => Boolean(values[key]?.trim()));

  for (const key of GITHUB_ENV_SECRETS) {
    const value = values[key]?.trim() ?? '';
    if (!value) pushUnique(missingRequired, key);
    else if (PLACEHOLDER_PATTERN.test(value)) pushUnique(placeholderKeys, key);
    else secrets.push({ key, value });
  }

  const qdrantNeedsApiKey = isHttpsUrl(values['QDRANT_URL']);

  for (const key of GITHUB_OPTIONAL_ENV_SECRETS) {
    const value = values[key]?.trim() ?? '';
    if (!value) {
      if (key === 'QDRANT_API_KEY' && qdrantNeedsApiKey) {
        pushUnique(missingRequired, key);
      } else {
        pushUnique(skippedOptionalSecrets, key);
      }
    } else if (PLACEHOLDER_PATTERN.test(value)) {
      pushUnique(placeholderKeys, key);
    } else {
      secrets.push({ key, value });
    }
  }

  for (const key of GCP_SECRET_MANAGER_SECRETS) {
    const value = values[key]?.trim() ?? '';
    if (!value) pushUnique(missingRequired, key);
    else if (PLACEHOLDER_PATTERN.test(value)) pushUnique(placeholderKeys, key);
    else gcpSecrets.push({ envKey: key, secretId: resolveSecretId(key), value });
  }

  for (const key of GCP_OPTIONAL_SECRET_MANAGER_SECRETS) {
    const value = values[key]?.trim() ?? '';
    if (!value) {
      if (key === 'QDRANT_API_KEY' && qdrantNeedsApiKey) pushUnique(missingRequired, key);
      continue;
    }
    if (PLACEHOLDER_PATTERN.test(value)) pushUnique(placeholderKeys, key);
    else gcpSecrets.push({ envKey: key, secretId: resolveSecretId(key), value });
  }

  for (const key of GITHUB_REQUIRED_ENV_VARS) {
    const value = values[key]?.trim() ?? '';
    if (!value) pushUnique(missingRequired, key);
    else if (PLACEHOLDER_PATTERN.test(value)) pushUnique(placeholderKeys, key);
    else variables.push({ key, value });
  }

  for (const key of GITHUB_OPTIONAL_ENV_VARS) {
    const value = values[key]?.trim() ?? '';
    if (!value) skippedOptionalVariables.push(key);
    else if (PLACEHOLDER_PATTERN.test(value)) pushUnique(placeholderKeys, key);
    else variables.push({ key, value });
  }

  if (missingRequired.length > 0 || placeholderKeys.length > 0 || retiredKeys.length > 0) {
    console.warn(
      JSON.stringify({
        event: 'deploy.env_sync.invalid_input',
        seam: 'UNSOUND_CONDITION',
        missingRequired,
        placeholderKeys,
        retiredKeys,
      }),
    );
  }

  return {
    secrets,
    gcpSecrets,
    variables,
    skippedOptionalSecrets,
    skippedOptionalVariables,
    missingRequired,
    placeholderKeys,
    retiredKeys,
  };
}

export function parseSyncCliArgs(argv: readonly string[]): ParsedSyncCliArgs {
  let env: TargetEnvironment = 'production';
  let filePath: string | null = null;
  let repo = DEFAULT_REPO;
  let dryRun = false;
  let bootstrapWif = false;
  let skipGcpSecrets = false;

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--') continue;
    if (token === '--env' || token === '-e' || token?.startsWith('--env=')) {
      const value = token.startsWith('--env=') ? token.slice('--env='.length) : argv[++i];
      if (value !== 'production') {
        throw new Error('Only the "production" environment is supported (local -> ci -> prod).');
      }
      env = value;
    } else if (token === '--file' || token === '-f' || token?.startsWith('--file=')) {
      const value = token.startsWith('--file=') ? token.slice('--file='.length) : argv[++i];
      if (!value) throw new Error('Expected a file path after --file.');
      filePath = value;
    } else if (token === '--repo' || token?.startsWith('--repo=')) {
      const value = token.startsWith('--repo=') ? token.slice('--repo='.length) : argv[++i];
      if (!value) throw new Error('Expected owner/repo after --repo.');
      repo = value;
    } else if (token === '--dry-run') {
      dryRun = true;
    } else if (token === '--bootstrap-wif') {
      bootstrapWif = true;
    } else if (token === '--skip-gcp-secrets') {
      skipGcpSecrets = true;
    } else {
      throw new Error(`Unknown option: ${String(token)}`);
    }
  }

  return {
    env,
    filePath: filePath ?? '.env.gcp.production.local',
    repo,
    dryRun,
    bootstrapWif,
    skipGcpSecrets,
  };
}

function ensureGithubEnvironment(repo: string, env: TargetEnvironment, dryRun: boolean): void {
  if (dryRun) {
    console.log(`[dry-run] Would ensure GitHub Environment "${env}" exists in ${repo}.`);
    return;
  }
  execFileSync('gh', ['api', '-X', 'PUT', `repos/${repo}/environments/${env}`], { stdio: 'pipe' });
}

function main(): void {
  const args = parseSyncCliArgs(process.argv.slice(2));
  const resolvedPath = resolve(process.cwd(), args.filePath);
  const values = parseEnvFileContent(readFileSync(resolvedPath, 'utf8'));
  const plan = buildSyncPlan(values);

  if (
    plan.missingRequired.length > 0 ||
    plan.placeholderKeys.length > 0 ||
    plan.retiredKeys.length > 0
  ) {
    const details: string[] = [];
    if (plan.missingRequired.length > 0) {
      details.push(`Missing required keys: ${plan.missingRequired.join(', ')}`);
    }
    if (plan.placeholderKeys.length > 0) {
      details.push(`Replace placeholder values before syncing: ${plan.placeholderKeys.join(', ')}`);
    }
    if (plan.retiredKeys.length > 0) {
      details.push(`Remove retired keys before syncing: ${plan.retiredKeys.join(', ')}`);
    }
    if (!args.dryRun) {
      throw new Error(`Cannot sync "${args.env}" from ${resolvedPath}:\n- ${details.join('\n- ')}`);
    }
    console.warn(`[dry-run warning] ${details.join(' | ')}`);
  }

  if (args.bootstrapWif) {
    bootstrapGcpWorkloadIdentity(values, args.repo, args.dryRun);
  }

  if (!args.skipGcpSecrets && plan.gcpSecrets.length > 0) {
    const projectId = values['GCP_PROJECT_ID']?.trim() ?? '';
    syncGcpSecretVersions(plan.gcpSecrets, projectId, args.dryRun);
  }

  ensureGithubEnvironment(args.repo, args.env, args.dryRun);

  for (const entry of plan.secrets) {
    if (args.dryRun) {
      console.log(`[dry-run] Would set secret   ${entry.key} (env: ${args.env}, value redacted)`);
    } else {
      execFileSync('gh', ['secret', 'set', entry.key, '--repo', args.repo, '--env', args.env], {
        input: entry.value,
        stdio: ['pipe', 'inherit', 'inherit'],
      });
    }
  }

  for (const entry of plan.variables) {
    if (args.dryRun) {
      console.log(`[dry-run] Would set variable ${entry.key}=${entry.value} (env: ${args.env})`);
    } else {
      execFileSync(
        'gh',
        [
          'variable',
          'set',
          entry.key,
          '--repo',
          args.repo,
          '--env',
          args.env,
          '--body',
          entry.value,
        ],
        { stdio: 'inherit' },
      );
    }
  }

  console.log(
    `\nSummary (${args.dryRun ? 'dry-run' : 'applied'} -> ${args.repo} [${args.env}]): ` +
      `${plan.secrets.length} GitHub secrets (${plan.skippedOptionalSecrets.length} optional secrets skipped), ` +
      `${args.skipGcpSecrets ? 0 : plan.gcpSecrets.length} Secret Manager secrets, ` +
      `${plan.variables.length} variables set, ${plan.skippedOptionalVariables.length} optional variables skipped.`,
  );
}

if (import.meta.main) {
  main();
}
