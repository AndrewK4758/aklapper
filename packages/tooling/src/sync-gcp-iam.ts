import {
  addAdminIapAccessorBinding,
  addBucketBinding,
  addCloudRunServiceBinding,
  addProjectBinding,
  addSecretBinding,
  addServiceAccountBinding,
  defaultGcloudExec,
  ensureRunIamBinderRole,
  type GcloudExecRunner,
} from './sync-gcp-iam-primitives.ts';

export {
  addProjectBinding,
  addServiceAccountBinding,
  defaultGcloudExec,
  RUN_IAM_BINDER_PERMISSIONS,
  RUN_IAM_BINDER_ROLE_ID,
  type GcloudExecRunner,
} from './sync-gcp-iam-primitives.ts';

export const PORTAL_SA_ALLOWED_SECRETS = ['INTERNAL_AUTH_SECRET'] as const;
export const PORTAL_API_SA_REQUIRED_SECRETS = [
  'PORTAL_DATABASE_URL',
  'INTERNAL_AUTH_SECRET',
  'ANALYTICS_DAILY_SALT',
] as const;
export const PORTAL_API_SA_OPTIONAL_SECRETS = ['AGENSI_API_KEY'] as const;

export interface EnsureRuntimeServiceAccountBindingsOptions {
  readonly projectId: string;
  readonly projectNumber?: string;
  readonly region?: string;
  readonly deployerSa: string;
  readonly runtimeSa?: string;
  readonly portalSa?: string;
  readonly portalApiSa?: string;
  readonly migratorSa?: string;
  readonly pg19VmSa?: string;
  readonly pg19BackupBucket?: string;
  readonly iapAccessorEmail?: string;
  readonly dryRun: boolean;
  readonly execGcloud?: GcloudExecRunner;
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
    portalSa,
    portalApiSa,
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
  ensureRunIamBinderRole(normalizedProject, normalizedDeployer, dryRun, execGcloud);

  const normalizedRegion = region.trim() || 'us-central1';

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

  // Dedicated least-privilege public portal SA: strictly INTERNAL_AUTH_SECRET + invoker on Wave 1 Go services.
  const normalizedPortalSa = portalSa?.trim();
  if (normalizedPortalSa) {
    addServiceAccountBinding(
      normalizedProject,
      normalizedPortalSa,
      'roles/iam.serviceAccountUser',
      `serviceAccount:${normalizedDeployer}`,
      dryRun,
      execGcloud,
    );
    for (const secretId of PORTAL_SA_ALLOWED_SECRETS) {
      addSecretBinding(
        normalizedProject,
        secretId,
        `serviceAccount:${normalizedPortalSa}`,
        'roles/secretmanager.secretAccessor',
        dryRun,
        execGcloud,
      );
    }
    for (const svc of ['ai-ask', 'cadence-demo', 'portal-api'] as const) {
      addCloudRunServiceBinding(
        normalizedProject,
        normalizedRegion,
        svc,
        `serviceAccount:${normalizedPortalSa}`,
        'roles/run.invoker',
        dryRun,
        execGcloud,
        { optional: true },
      );
    }
  }

  // Dedicated least-privilege portal-api SA: strictly portal_app DSN, HMAC secret, daily salt, and optional Agensi key.
  const normalizedPortalApiSa = portalApiSa?.trim();
  if (normalizedPortalApiSa) {
    addServiceAccountBinding(
      normalizedProject,
      normalizedPortalApiSa,
      'roles/iam.serviceAccountUser',
      `serviceAccount:${normalizedDeployer}`,
      dryRun,
      execGcloud,
    );
    for (const secretId of PORTAL_API_SA_REQUIRED_SECRETS) {
      addSecretBinding(
        normalizedProject,
        secretId,
        `serviceAccount:${normalizedPortalApiSa}`,
        'roles/secretmanager.secretAccessor',
        dryRun,
        execGcloud,
      );
    }
    for (const secretId of PORTAL_API_SA_OPTIONAL_SECRETS) {
      addSecretBinding(
        normalizedProject,
        secretId,
        `serviceAccount:${normalizedPortalApiSa}`,
        'roles/secretmanager.secretAccessor',
        dryRun,
        execGcloud,
        { optional: true },
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
