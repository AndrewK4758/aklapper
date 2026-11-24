import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const GITHUB_ENV_SECRETS = [
  'GCP_WORKLOAD_IDENTITY_PROVIDER',
  'GCP_WIF_SERVICE_ACCOUNT',
  'DATABASE_URL',
  'INTERNAL_AUTH_SECRET',
  'TOTP_ENCRYPTION_KEY',
  'ANALYTICS_DAILY_SALT',
  'ADMIN_BOOTSTRAP_TOKEN',
] as const;

export const GITHUB_OPTIONAL_ENV_SECRETS = ['QDRANT_API_KEY'] as const;

export const GITHUB_REQUIRED_ENV_VARS = ['GCP_PROJECT_ID', 'GCP_REGION', 'GAR_REPOSITORY'] as const;

export const GITHUB_OPTIONAL_ENV_VARS = [
  'CLOUD_SQL_INSTANCE',
  'GKE_CLUSTER_NAME',
  'GKE_CLUSTER_LOCATION',
  'AI_PROVIDER',
  'GCP_LOCATION',
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
  'AUTH_API_URL',
  'ANALYTICS_API_URL',
  'K8S_WATCH_URL',
  'CADENCE_DEMO_URL',
  'AI_ASK_URL',
  'CADENCE_ADMIN_URL',
  'CONTACT_API_URL',
  'QDRANT_URL',
  'CLOUD_RUN_ALLOW_UNAUTH_ADMIN',
  'CLOUD_RUN_ALLOW_UNAUTH_APIS',
] as const;

export type TargetEnvironment = 'production';

export interface ParsedSyncCliArgs {
  readonly env: TargetEnvironment;
  readonly filePath: string;
  readonly repo: string;
  readonly dryRun: boolean;
  readonly bootstrapWif: boolean;
}

export interface SyncEntry {
  readonly key: string;
  readonly value: string;
}

export interface SyncPlan {
  readonly secrets: readonly SyncEntry[];
  readonly variables: readonly SyncEntry[];
  readonly skippedOptionalSecrets: readonly string[];
  readonly skippedOptionalVariables: readonly string[];
  readonly missingRequired: readonly string[];
  readonly placeholderKeys: readonly string[];
}

const DEFAULT_REPO = 'AndrewK4758/aklapper';
const PLACEHOLDER_PATTERN = /REPLACE_ME|CHANGE_ME|YOUR_[A-Z0-9_]+/i;

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

function classifyKeys(
  keys: readonly string[],
  values: Readonly<Record<string, string>>,
  options: { readonly required: boolean },
  targetEntries: SyncEntry[],
  missingRequired: string[],
  skippedOptional: string[],
  placeholderKeys: string[],
): void {
  for (const key of keys) {
    const value = values[key]?.trim() ?? '';
    if (!value) {
      if (options.required) {
        missingRequired.push(key);
      } else {
        skippedOptional.push(key);
      }
    } else if (PLACEHOLDER_PATTERN.test(value)) {
      placeholderKeys.push(key);
    } else {
      targetEntries.push({ key, value });
    }
  }
}

export function buildSyncPlan(values: Readonly<Record<string, string>>): SyncPlan {
  const secrets: SyncEntry[] = [];
  const variables: SyncEntry[] = [];
  const skippedOptionalSecrets: string[] = [];
  const skippedOptionalVariables: string[] = [];
  const missingRequired: string[] = [];
  const placeholderKeys: string[] = [];

  classifyKeys(
    GITHUB_ENV_SECRETS,
    values,
    { required: true },
    secrets,
    missingRequired,
    skippedOptionalSecrets,
    placeholderKeys,
  );
  classifyKeys(
    GITHUB_OPTIONAL_ENV_SECRETS,
    values,
    { required: false },
    secrets,
    missingRequired,
    skippedOptionalSecrets,
    placeholderKeys,
  );
  classifyKeys(
    GITHUB_REQUIRED_ENV_VARS,
    values,
    { required: true },
    variables,
    missingRequired,
    skippedOptionalVariables,
    placeholderKeys,
  );
  classifyKeys(
    GITHUB_OPTIONAL_ENV_VARS,
    values,
    { required: false },
    variables,
    missingRequired,
    skippedOptionalVariables,
    placeholderKeys,
  );

  return {
    secrets,
    variables,
    skippedOptionalSecrets,
    skippedOptionalVariables,
    missingRequired,
    placeholderKeys,
  };
}

export function parseSyncCliArgs(argv: readonly string[]): ParsedSyncCliArgs {
  let env: TargetEnvironment = 'production';
  let filePath: string | null = null;
  let repo = DEFAULT_REPO;
  let dryRun = false;
  let bootstrapWif = false;

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--') {
      continue;
    }
    if (token === '--env' || token === '-e') {
      const value = argv[i + 1];
      if (value !== 'production') {
        throw new Error('Only the "production" environment is supported (local -> ci -> prod).');
      }
      env = value;
      i += 1;
    } else if (token?.startsWith('--env=')) {
      const value = token.slice('--env='.length);
      if (value !== 'production') {
        throw new Error('Only the "production" environment is supported (local -> ci -> prod).');
      }
      env = value;
    } else if (token === '--file' || token === '-f') {
      const value = argv[i + 1];
      if (!value) {
        throw new Error('Expected a file path after --file.');
      }
      filePath = value;
      i += 1;
    } else if (token?.startsWith('--file=')) {
      filePath = token.slice('--file='.length);
    } else if (token === '--repo') {
      const value = argv[i + 1];
      if (!value) {
        throw new Error('Expected owner/repo after --repo.');
      }
      repo = value;
      i += 1;
    } else if (token?.startsWith('--repo=')) {
      repo = token.slice('--repo='.length);
    } else if (token === '--dry-run') {
      dryRun = true;
    } else if (token === '--bootstrap-wif') {
      bootstrapWif = true;
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
  };
}

function extractWifPoolAndProvider(providerResourceName: string): {
  projectNumber: string;
  poolId: string;
  providerId: string;
} {
  const match =
    /^projects\/(\d+)\/locations\/global\/workloadIdentityPools\/([^/]+)\/providers\/([^/]+)$/.exec(
      providerResourceName,
    );
  if (!match) {
    throw new Error(
      `Invalid GCP_WORKLOAD_IDENTITY_PROVIDER resource path: "${providerResourceName}"`,
    );
  }
  const [, projectNumber, poolId, providerId] = match;
  if (!projectNumber || !poolId || !providerId) {
    throw new Error(`Malformed GCP_WORKLOAD_IDENTITY_PROVIDER: "${providerResourceName}"`);
  }
  return { projectNumber, poolId, providerId };
}

function bootstrapGcpWorkloadIdentity(
  values: Readonly<Record<string, string>>,
  repo: string,
  dryRun: boolean,
): void {
  const projectId = values['GCP_PROJECT_ID']?.trim();
  const serviceAccount = values['GCP_WIF_SERVICE_ACCOUNT']?.trim();
  const providerPath = values['GCP_WORKLOAD_IDENTITY_PROVIDER']?.trim();

  if (!projectId || !serviceAccount || !providerPath) {
    throw new Error(
      '--bootstrap-wif requires GCP_PROJECT_ID, GCP_WIF_SERVICE_ACCOUNT, and GCP_WORKLOAD_IDENTITY_PROVIDER in the env file.',
    );
  }

  const { projectNumber, poolId, providerId } = extractWifPoolAndProvider(providerPath);
  const principalSet = `principalSet://iam.googleapis.com/projects/${projectNumber}/locations/global/workloadIdentityPools/${poolId}/attribute.repository/${repo}`;

  if (dryRun) {
    console.log(
      `[dry-run] Would ensure OIDC provider "${providerId}" exists in pool "${poolId}" (project ${projectId}) locked to repository "${repo}".`,
    );
    console.log(
      `[dry-run] Would bind roles/iam.workloadIdentityUser and roles/iam.serviceAccountUser on ${serviceAccount}.`,
    );
    return;
  }

  let providerExists: boolean;
  try {
    execFileSync(
      'gcloud',
      [
        'iam',
        'workload-identity-pools',
        'providers',
        'describe',
        providerId,
        '--project',
        projectId,
        '--location=global',
        '--workload-identity-pool',
        poolId,
        '--format=value(name)',
      ],
      { stdio: 'pipe' },
    );
    providerExists = true;
  } catch {
    providerExists = false;
  }

  if (providerExists) {
    console.log(`✓ WIF OIDC provider "${providerId}" already exists in pool "${poolId}".`);
  } else {
    execFileSync(
      'gcloud',
      [
        'iam',
        'workload-identity-pools',
        'providers',
        'create-oidc',
        providerId,
        '--project',
        projectId,
        '--location=global',
        '--workload-identity-pool',
        poolId,
        '--display-name=GitHub Actions OIDC',
        '--issuer-uri=https://token.actions.githubusercontent.com',
        '--attribute-mapping=google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository,attribute.ref=assertion.ref',
        `--attribute-condition=assertion.repository == '${repo}'`,
      ],
      { stdio: 'inherit' },
    );
    console.log(`✓ Created WIF OIDC provider "${providerId}" in pool "${poolId}".`);
  }

  execFileSync(
    'gcloud',
    [
      'iam',
      'service-accounts',
      'add-iam-policy-binding',
      serviceAccount,
      '--project',
      projectId,
      '--role=roles/iam.workloadIdentityUser',
      `--member=${principalSet}`,
    ],
    { stdio: 'inherit' },
  );

  execFileSync(
    'gcloud',
    [
      'iam',
      'service-accounts',
      'add-iam-policy-binding',
      serviceAccount,
      '--project',
      projectId,
      '--role=roles/iam.serviceAccountUser',
      `--member=serviceAccount:${serviceAccount}`,
    ],
    { stdio: 'inherit' },
  );

  console.log(`✓ Bound Workload Identity & Service Account User IAM roles on ${serviceAccount}.`);
}

function ensureGithubEnvironment(repo: string, env: TargetEnvironment, dryRun: boolean): void {
  if (dryRun) {
    console.log(`[dry-run] Would ensure GitHub Environment "${env}" exists in ${repo}.`);
    return;
  }
  execFileSync('gh', ['api', '-X', 'PUT', `repos/${repo}/environments/${env}`], {
    stdio: 'pipe',
  });
  console.log(`✓ Ensured GitHub Environment "${env}" exists in ${repo}.`);
}

function main(): void {
  const args = parseSyncCliArgs(process.argv.slice(2));
  const resolvedPath = resolve(process.cwd(), args.filePath);
  const content = readFileSync(resolvedPath, 'utf8');
  const values = parseEnvFileContent(content);
  const plan = buildSyncPlan(values);

  if (plan.missingRequired.length > 0 || plan.placeholderKeys.length > 0) {
    const details: string[] = [];
    if (plan.missingRequired.length > 0) {
      details.push(`Missing required keys: ${plan.missingRequired.join(', ')}`);
    }
    if (plan.placeholderKeys.length > 0) {
      details.push(`Replace placeholder values before syncing: ${plan.placeholderKeys.join(', ')}`);
    }
    if (!args.dryRun) {
      throw new Error(`Cannot sync "${args.env}" from ${resolvedPath}:\n- ${details.join('\n- ')}`);
    }
    console.warn(`[dry-run warning] ${details.join(' | ')}`);
  }

  if (args.bootstrapWif) {
    bootstrapGcpWorkloadIdentity(values, args.repo, args.dryRun);
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
      `${plan.secrets.length} secrets (${plan.skippedOptionalSecrets.length} optional secrets skipped), ` +
      `${plan.variables.length} variables (${plan.skippedOptionalVariables.length} optional variables skipped).`,
  );
}

if (import.meta.main) {
  main();
}
