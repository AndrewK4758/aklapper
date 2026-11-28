import { execFileSync } from 'node:child_process';

export type GcloudExecRunner = (args: readonly string[], input?: string) => string;

export const RUN_IAM_BINDER_ROLE_ID = 'aklapperRunIamBinder';
export const RUN_IAM_BINDER_PERMISSIONS = [
  'run.services.getIamPolicy',
  'run.services.setIamPolicy',
] as const;

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

export function addBucketBinding(
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

function secretExists(projectId: string, secretId: string, execGcloud: GcloudExecRunner): boolean {
  try {
    execGcloud(['secrets', 'describe', secretId, '--project', projectId, '--format=value(name)']);
    return true;
  } catch {
    return false;
  }
}

export function addSecretBinding(
  projectId: string,
  secretId: string,
  member: string,
  role: string,
  dryRun: boolean,
  execGcloud: GcloudExecRunner,
  options?: { readonly optional?: boolean },
): void {
  if (dryRun) {
    console.log(
      `[dry-run] Would grant ${role} on secret ${secretId} (${projectId})${options?.optional ? ' if present' : ''} to ${member}.`,
    );
    return;
  }
  if (options?.optional && !secretExists(projectId, secretId, execGcloud)) {
    console.log(
      `Skipping optional secret IAM binding for absent secret "${secretId}" in project ${projectId}.`,
    );
    return;
  }
  execGcloud([
    'secrets',
    'add-iam-policy-binding',
    secretId,
    `--project=${projectId}`,
    `--member=${member}`,
    `--role=${role}`,
  ]);
}

function cloudRunServiceExists(
  projectId: string,
  region: string,
  service: string,
  execGcloud: GcloudExecRunner,
): boolean {
  try {
    execGcloud([
      'run',
      'services',
      'describe',
      service,
      `--project=${projectId}`,
      `--region=${region}`,
      '--format=value(metadata.name)',
    ]);
    return true;
  } catch {
    return false;
  }
}

export function addCloudRunServiceBinding(
  projectId: string,
  region: string,
  service: string,
  member: string,
  role: string,
  dryRun: boolean,
  execGcloud: GcloudExecRunner,
  options?: { readonly optional?: boolean },
): void {
  if (dryRun) {
    console.log(
      `[dry-run] Would grant ${role} on Cloud Run service ${service} (${region}/${projectId})${options?.optional ? ' if deployed' : ''} to ${member}.`,
    );
    return;
  }
  if (options?.optional && !cloudRunServiceExists(projectId, region, service, execGcloud)) {
    console.log(
      `Skipping Cloud Run IAM binding for undeployed service "${service}" (${region}/${projectId}); Wave 1 deploy will apply it idempotently.`,
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

export function ensureRunIamBinderRole(
  projectId: string,
  deployerSa: string,
  dryRun: boolean,
  execGcloud: GcloudExecRunner,
): void {
  const roleName = `projects/${projectId}/roles/${RUN_IAM_BINDER_ROLE_ID}`;
  const permsCsv = RUN_IAM_BINDER_PERMISSIONS.join(',');
  if (dryRun) {
    console.log(
      `[dry-run] Would ensure custom role ${roleName} (${permsCsv}) and bind to serviceAccount:${deployerSa}.`,
    );
    return;
  }

  let exists = true;
  try {
    execGcloud([
      'iam',
      'roles',
      'describe',
      RUN_IAM_BINDER_ROLE_ID,
      `--project=${projectId}`,
      '--format=value(name)',
    ]);
  } catch {
    exists = false;
  }

  if (!exists) {
    execGcloud([
      'iam',
      'roles',
      'create',
      RUN_IAM_BINDER_ROLE_ID,
      `--project=${projectId}`,
      '--title=Cloud Run Service IAM Binder',
      '--description=Narrow permission for deployer to bind service-level Cloud Run IAM policies',
      `--permissions=${permsCsv}`,
      '--stage=GA',
    ]);
  } else {
    execGcloud([
      'iam',
      'roles',
      'update',
      RUN_IAM_BINDER_ROLE_ID,
      `--project=${projectId}`,
      `--permissions=${permsCsv}`,
      '--quiet',
    ]);
  }

  addProjectBinding(projectId, `serviceAccount:${deployerSa}`, roleName, dryRun, execGcloud);
}

export function addAdminIapAccessorBinding(
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
