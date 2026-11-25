import { execFileSync } from 'node:child_process';

export const GCP_SECRET_MANAGER_SECRETS = [
  'DATABASE_URL',
  'INTERNAL_AUTH_SECRET',
  'TOTP_ENCRYPTION_KEY',
  'ANALYTICS_DAILY_SALT',
] as const;

export const GCP_OPTIONAL_SECRET_MANAGER_SECRETS = [
  'QDRANT_API_KEY',
  'ADMIN_PASSWORD',
  'AGENSI_API_KEY',
  'AI_PRIVACY_DENYLIST',
  'DOSSIER_PRIVACY_DENYLIST',
] as const;

export interface GcpSecretSyncEntry {
  readonly envKey: string;
  readonly secretId: string;
  readonly value: string;
}

export type GcloudExecRunner = (args: readonly string[], input?: string) => string;

export interface EnsureRuntimeServiceAccountBindingsOptions {
  readonly projectId: string;
  readonly deployerSa: string;
  readonly runtimeSa?: string;
  readonly migratorSa?: string;
  readonly gkeWorkloadSa?: string;
  readonly dryRun: boolean;
  readonly execGcloud?: GcloudExecRunner;
}

const VALID_SECRET_ID_RE = /^[A-Za-z0-9_-]{1,255}$/;

function defaultGcloudExec(args: readonly string[], input?: string): string {
  return execFileSync('gcloud', [...args], {
    input,
    encoding: 'utf8',
    stdio: input !== undefined ? ['pipe', 'pipe', 'pipe'] : ['ignore', 'pipe', 'pipe'],
  });
}

export function resolveSecretId(envKey: string): string {
  const normalized = envKey.trim();
  if (!VALID_SECRET_ID_RE.test(normalized)) {
    throw new Error(`Invalid GCP Secret Manager identifier for key "${envKey}"`);
  }
  return normalized;
}

export function syncGcpSecretVersions(
  entries: readonly GcpSecretSyncEntry[],
  projectId: string,
  dryRun: boolean,
  execGcloud: GcloudExecRunner = defaultGcloudExec,
): void {
  const normalizedProject = projectId.trim();
  if (!normalizedProject) {
    throw new Error('GCP_PROJECT_ID is required to sync Secret Manager secrets.');
  }

  for (const entry of entries) {
    const secretId = resolveSecretId(entry.secretId);
    if (dryRun) {
      console.log(
        `[dry-run] Would sync Secret Manager secret "${secretId}" in project ${normalizedProject} via stdin (value redacted).`,
      );
      continue;
    }

    let exists = true;
    try {
      execGcloud([
        'secrets',
        'describe',
        secretId,
        '--project',
        normalizedProject,
        '--format=value(name)',
      ]);
    } catch {
      exists = false;
    }

    try {
      if (!exists) {
        execGcloud([
          'secrets',
          'create',
          secretId,
          '--project',
          normalizedProject,
          '--replication-policy=automatic',
        ]);
      }
      execGcloud(
        ['secrets', 'versions', 'add', secretId, '--project', normalizedProject, '--data-file=-'],
        entry.value,
      );
    } catch {
      throw new Error(
        `Failed syncing Secret Manager secret "${secretId}" in project "${normalizedProject}".`,
      );
    }
  }

  console.info(
    JSON.stringify({
      event: 'deploy.secret_sync.applied',
      seam: 'DELTA_AUDIT_GAP',
      projectId: normalizedProject,
      dryRun,
      secretIds: entries.map(entry => resolveSecretId(entry.secretId)),
    }),
  );
}

function addProjectBinding(
  projectId: string,
  member: string,
  role: string,
  dryRun: boolean,
  execGcloud: GcloudExecRunner,
): void {
  if (dryRun) {
    console.log(`[dry-run] Would grant ${role} on project ${projectId} to ${member}.`);
    return;
  }
  execGcloud([
    'projects',
    'add-iam-policy-binding',
    projectId,
    `--member=${member}`,
    `--role=${role}`,
    '--condition=None',
  ]);
}

function addServiceAccountBinding(
  projectId: string,
  targetSa: string,
  role: string,
  member: string,
  dryRun: boolean,
  execGcloud: GcloudExecRunner,
): void {
  if (dryRun) {
    console.log(
      `[dry-run] Would grant ${role} on service account ${targetSa} (${projectId}) to ${member}.`,
    );
    return;
  }
  execGcloud([
    'iam',
    'service-accounts',
    'add-iam-policy-binding',
    targetSa,
    `--project=${projectId}`,
    `--role=${role}`,
    `--member=${member}`,
  ]);
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
  if (!match || !match[1] || !match[2] || !match[3]) {
    throw new Error(
      `Invalid GCP_WORKLOAD_IDENTITY_PROVIDER resource path: "${providerResourceName}"`,
    );
  }
  return { projectNumber: match[1], poolId: match[2], providerId: match[3] };
}

export function bootstrapGcpWorkloadIdentity(
  values: Readonly<Record<string, string>>,
  repo: string,
  dryRun: boolean,
  execGcloud: GcloudExecRunner = defaultGcloudExec,
): void {
  const projectId = values['GCP_PROJECT_ID']?.trim();
  const deployerSa = values['GCP_WIF_SERVICE_ACCOUNT']?.trim();
  const providerPath = values['GCP_WORKLOAD_IDENTITY_PROVIDER']?.trim();

  if (!projectId || !deployerSa || !providerPath) {
    throw new Error(
      '--bootstrap-wif requires GCP_PROJECT_ID, GCP_WIF_SERVICE_ACCOUNT, and GCP_WORKLOAD_IDENTITY_PROVIDER in the env file.',
    );
  }

  const { projectNumber, poolId, providerId } = extractWifPoolAndProvider(providerPath);
  const principalSet = `principalSet://iam.googleapis.com/projects/${projectNumber}/locations/global/workloadIdentityPools/${poolId}/attribute.repository/${repo}`;

  if (dryRun) {
    console.log(
      `[dry-run] Would ensure OIDC provider "${providerId}" in pool "${poolId}" (${projectId}) locked to "${repo}".`,
    );
  } else {
    let providerExists = true;
    try {
      execGcloud([
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
      ]);
    } catch {
      providerExists = false;
    }

    if (!providerExists) {
      execGcloud([
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
      ]);
    }
  }

  addServiceAccountBinding(
    projectId,
    deployerSa,
    'roles/iam.workloadIdentityUser',
    principalSet,
    dryRun,
    execGcloud,
  );
  addServiceAccountBinding(
    projectId,
    deployerSa,
    'roles/iam.serviceAccountUser',
    `serviceAccount:${deployerSa}`,
    dryRun,
    execGcloud,
  );

  ensureRuntimeServiceAccountBindings({
    projectId,
    deployerSa,
    runtimeSa: values['GCP_CLOUDRUN_SERVICE_ACCOUNT'],
    migratorSa: values['GCP_MIGRATOR_SERVICE_ACCOUNT'],
    gkeWorkloadSa: values['GCP_GKE_WORKLOAD_SA'],
    dryRun,
    execGcloud,
  });
}

export function ensureRuntimeServiceAccountBindings(
  options: EnsureRuntimeServiceAccountBindingsOptions,
): void {
  const {
    projectId,
    deployerSa,
    runtimeSa,
    migratorSa,
    gkeWorkloadSa,
    dryRun,
    execGcloud = defaultGcloudExec,
  } = options;
  const normalizedProject = projectId.trim();
  const normalizedDeployer = deployerSa.trim();
  if (!normalizedProject || !normalizedDeployer) {
    throw new Error('projectId and deployerSa are required for runtime SA IAM bindings.');
  }

  // Deployer WIF SA needs roles/run.invoker for post-deploy IAM-protected /healthz probes.
  addProjectBinding(
    normalizedProject,
    `serviceAccount:${normalizedDeployer}`,
    'roles/run.invoker',
    dryRun,
    execGcloud,
  );

  const saGrants: Array<{
    sa?: string;
    roles: readonly string[];
    allowDeployerImpersonation: boolean;
  }> = [
    {
      sa: runtimeSa,
      roles: [
        'roles/run.invoker',
        'roles/cloudsql.client',
        'roles/secretmanager.secretAccessor',
        'roles/aiplatform.user',
      ],
      allowDeployerImpersonation: true,
    },
    {
      sa: migratorSa,
      roles: ['roles/cloudsql.client', 'roles/secretmanager.secretAccessor'],
      allowDeployerImpersonation: true,
    },
    {
      sa: gkeWorkloadSa,
      roles: [
        'roles/cloudsql.client',
        'roles/secretmanager.secretAccessor',
        'roles/aiplatform.user',
      ],
      allowDeployerImpersonation: false,
    },
  ];

  for (const grant of saGrants) {
    const targetSa = grant.sa?.trim();
    if (!targetSa) continue;
    for (const role of grant.roles) {
      addProjectBinding(normalizedProject, `serviceAccount:${targetSa}`, role, dryRun, execGcloud);
    }
    if (grant.allowDeployerImpersonation) {
      addServiceAccountBinding(
        normalizedProject,
        targetSa,
        'roles/iam.serviceAccountUser',
        `serviceAccount:${normalizedDeployer}`,
        dryRun,
        execGcloud,
      );
    }
  }

  const normalizedGkeSa = gkeWorkloadSa?.trim();
  if (normalizedGkeSa) {
    for (const nsSa of [
      'portfolio-public/ai-ask',
      'portfolio-public/cadence-demo',
      'cadence-admin/cadence-admin',
    ]) {
      addServiceAccountBinding(
        normalizedProject,
        normalizedGkeSa,
        'roles/iam.workloadIdentityUser',
        `serviceAccount:${normalizedProject}.svc.id.goog[${nsSa}]`,
        dryRun,
        execGcloud,
      );
    }
  }
}
