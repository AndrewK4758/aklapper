import { execFileSync } from 'node:child_process';

export type GcloudExecRunner = (args: readonly string[], input?: string) => string;

export interface EnsureRuntimeServiceAccountBindingsOptions {
  readonly projectId: string;
  readonly projectNumber?: string;
  readonly region?: string;
  readonly deployerSa: string;
  readonly runtimeSa?: string;
  readonly migratorSa?: string;
  readonly pg19VmSa?: string;
  readonly pg19BackupBucket?: string;
  readonly iapAccessorEmail?: string;
  readonly dryRun: boolean;
  readonly execGcloud?: GcloudExecRunner;
}

export function defaultGcloudExec(args: readonly string[], input?: string): string {
  return execFileSync('gcloud', [...args], {
    input,
    encoding: 'utf8',
    stdio: input !== undefined ? ['pipe', 'pipe', 'pipe'] : ['ignore', 'pipe', 'pipe'],
  });
}

export function addProjectBinding(
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

export function addServiceAccountBinding(
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

function addBucketBinding(
  bucketUrl: string,
  member: string,
  role: string,
  dryRun: boolean,
  execGcloud: GcloudExecRunner,
): void {
  if (dryRun) {
    console.log(`[dry-run] Would grant ${role} on bucket ${bucketUrl} to ${member}.`);
    return;
  }
  execGcloud([
    'storage',
    'buckets',
    'add-iam-policy-binding',
    bucketUrl,
    `--member=${member}`,
    `--role=${role}`,
  ]);
}

function addCloudRunServiceBinding(
  projectId: string,
  region: string,
  service: string,
  member: string,
  role: string,
  dryRun: boolean,
  execGcloud: GcloudExecRunner,
): void {
  if (dryRun) {
    console.log(
      `[dry-run] Would grant ${role} on Cloud Run service ${service} (${region}/${projectId}) to ${member}.`,
    );
    return;
  }
  execGcloud([
    'run',
    'services',
    'add-iam-policy-binding',
    service,
    `--project=${projectId}`,
    `--region=${region}`,
    `--member=${member}`,
    `--role=${role}`,
  ]);
}

function addAdminIapAccessorBinding(
  projectId: string,
  region: string,
  member: string,
  dryRun: boolean,
  execGcloud: GcloudExecRunner,
): void {
  if (dryRun) {
    console.log(
      `[dry-run] Would grant roles/iap.httpsResourceAccessor on Cloud Run admin (${region}/${projectId}) to ${member}.`,
    );
    return;
  }
  execGcloud([
    'beta',
    'iap',
    'web',
    'add-iam-policy-binding',
    '--resource-type=cloud-run',
    '--service=admin',
    `--region=${region}`,
    `--project=${projectId}`,
    `--member=${member}`,
    '--role=roles/iap.httpsResourceAccessor',
  ]);
}

export function ensureRuntimeServiceAccountBindings(
  options: EnsureRuntimeServiceAccountBindingsOptions,
): void {
  const {
    projectId,
    projectNumber,
    region = 'us-central1',
    deployerSa,
    runtimeSa,
    migratorSa,
    pg19VmSa,
    pg19BackupBucket,
    iapAccessorEmail,
    dryRun,
    execGcloud = defaultGcloudExec,
  } = options;
  const normalizedProject = projectId.trim();
  const normalizedDeployer = deployerSa.trim();
  if (!normalizedProject || !normalizedDeployer) {
    throw new Error('projectId and deployerSa are required for runtime SA IAM bindings.');
  }

  for (const role of ['roles/run.invoker', 'roles/run.developer']) {
    addProjectBinding(
      normalizedProject,
      `serviceAccount:${normalizedDeployer}`,
      role,
      dryRun,
      execGcloud,
    );
  }

  const saGrants: Array<{
    sa?: string;
    roles: readonly string[];
    allowDeployerImpersonation: boolean;
  }> = [
    {
      sa: runtimeSa,
      roles: ['roles/run.invoker', 'roles/secretmanager.secretAccessor', 'roles/aiplatform.user'],
      allowDeployerImpersonation: true,
    },
    {
      sa: migratorSa,
      roles: ['roles/secretmanager.secretAccessor'],
      allowDeployerImpersonation: true,
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

  const normalizedPg19VmSa = pg19VmSa?.trim();
  if (normalizedPg19VmSa) {
    addProjectBinding(
      normalizedProject,
      `serviceAccount:${normalizedPg19VmSa}`,
      'roles/logging.logWriter',
      dryRun,
      execGcloud,
    );
    const bucketUrl = pg19BackupBucket?.trim() || `gs://${normalizedProject}-pg19-backups`;
    addBucketBinding(
      bucketUrl,
      `serviceAccount:${normalizedPg19VmSa}`,
      'roles/storage.objectCreator',
      dryRun,
      execGcloud,
    );
  }

  const normalizedRegion = region.trim() || 'us-central1';
  addAdminIapAccessorBinding(
    normalizedProject,
    normalizedRegion,
    `serviceAccount:${normalizedDeployer}`,
    dryRun,
    execGcloud,
  );
  const normalizedIapEmail = iapAccessorEmail?.trim();
  if (normalizedIapEmail) {
    addAdminIapAccessorBinding(
      normalizedProject,
      normalizedRegion,
      `user:${normalizedIapEmail}`,
      dryRun,
      execGcloud,
    );
  }

  const normalizedProjectNumber = projectNumber?.trim();
  if (normalizedProjectNumber) {
    addCloudRunServiceBinding(
      normalizedProject,
      normalizedRegion,
      'admin',
      `serviceAccount:service-${normalizedProjectNumber}@gcp-sa-iap.iam.gserviceaccount.com`,
      'roles/run.invoker',
      dryRun,
      execGcloud,
    );
  }
}
