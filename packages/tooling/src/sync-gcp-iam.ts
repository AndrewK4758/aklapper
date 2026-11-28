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

export const ADMIN_SA_ALLOWED_SECRETS = [
  'ADMIN_INTERNAL_AUTH_SECRET',
  'INTERNAL_AUTH_SECRET',
] as const;
export const ADMIN_API_SA_REQUIRED_SECRETS = [
  'ADMIN_DATABASE_URL',
  'ADMIN_INTERNAL_AUTH_SECRET',
  'TOTP_ENCRYPTION_KEY',
  'ANALYTICS_DAILY_SALT',
] as const;
export const ADMIN_API_SA_OPTIONAL_SECRETS = [
  'DOSSIER_PRIVACY_DENYLIST',
  'QDRANT_API_KEY',
  'AGENSI_API_KEY',
  'INTERNAL_AUTH_SECRET',
] as const;

export interface EnsureRuntimeServiceAccountBindingsOptions {
  readonly projectId: string;
  readonly projectNumber?: string;
  readonly region?: string;
  readonly deployerSa: string;
  readonly runtimeSa?: string;
  readonly portalSa?: string;
  readonly portalApiSa?: string;
  readonly adminSa?: string;
  readonly adminApiSa?: string;
  readonly migratorSa?: string;
  readonly pg19VmSa?: string;
  readonly pg19BackupBucket?: string;
  readonly iapAccessorEmail?: string;
  readonly dryRun: boolean;
  readonly execGcloud?: GcloudExecRunner;
}

interface ScopedSaBindingSpec {
  readonly serviceAccount: string;
  readonly requiredSecrets: readonly string[];
  readonly optionalSecrets?: readonly string[];
  readonly invokerServices?: readonly string[];
}

function bindScopedRuntimeServiceAccount(
  context: {
    readonly projectId: string;
    readonly region: string;
    readonly deployerSa: string;
    readonly dryRun: boolean;
    readonly execGcloud: GcloudExecRunner;
  },
  spec: ScopedSaBindingSpec,
): void {
  const member = `serviceAccount:${spec.serviceAccount}`;
  addServiceAccountBinding(
    context.projectId,
    spec.serviceAccount,
    'roles/iam.serviceAccountUser',
    `serviceAccount:${context.deployerSa}`,
    context.dryRun,
    context.execGcloud,
  );
  for (const secretId of spec.requiredSecrets) {
    addSecretBinding(
      context.projectId,
      secretId,
      member,
      'roles/secretmanager.secretAccessor',
      context.dryRun,
      context.execGcloud,
    );
  }
  for (const secretId of spec.optionalSecrets ?? []) {
    addSecretBinding(
      context.projectId,
      secretId,
      member,
      'roles/secretmanager.secretAccessor',
      context.dryRun,
      context.execGcloud,
      { optional: true },
    );
  }
  for (const svc of spec.invokerServices ?? []) {
    addCloudRunServiceBinding(
      context.projectId,
      context.region,
      svc,
      member,
      'roles/run.invoker',
      context.dryRun,
      context.execGcloud,
      { optional: true },
    );
  }
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
    adminSa,
    adminApiSa,
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

  const normalizedAdminSa = adminSa?.trim() ?? '';
  const normalizedAdminApiSa = adminApiSa?.trim() ?? '';
  if ('adminSa' in options && options.adminSa !== undefined && !normalizedAdminSa) {
    throw new Error(
      'adminSa (GCP_ADMIN_SERVICE_ACCOUNT) must be non-empty when provided (fail-closed; no fallback to GCP_CLOUDRUN_SERVICE_ACCOUNT).',
    );
  }
  if ('adminApiSa' in options && options.adminApiSa !== undefined && !normalizedAdminApiSa) {
    throw new Error(
      'adminApiSa (GCP_ADMIN_API_SERVICE_ACCOUNT) must be non-empty when provided (fail-closed; no fallback to GCP_CLOUDRUN_SERVICE_ACCOUNT).',
    );
  }
  if (Boolean(normalizedAdminSa) !== Boolean(normalizedAdminApiSa)) {
    throw new Error(
      'Both adminSa (GCP_ADMIN_SERVICE_ACCOUNT) and adminApiSa (GCP_ADMIN_API_SERVICE_ACCOUNT) must be provided together (fail-closed; no fallback to GCP_CLOUDRUN_SERVICE_ACCOUNT).',
    );
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

  const scopedContext = {
    projectId: normalizedProject,
    region: normalizedRegion,
    deployerSa: normalizedDeployer,
    dryRun,
    execGcloud,
  };

  const normalizedPortalSa = portalSa?.trim();
  if (normalizedPortalSa) {
    bindScopedRuntimeServiceAccount(scopedContext, {
      serviceAccount: normalizedPortalSa,
      requiredSecrets: PORTAL_SA_ALLOWED_SECRETS,
      invokerServices: ['ai-ask', 'cadence-demo', 'portal-api'],
    });
  }

  const normalizedPortalApiSa = portalApiSa?.trim();
  if (normalizedPortalApiSa) {
    bindScopedRuntimeServiceAccount(scopedContext, {
      serviceAccount: normalizedPortalApiSa,
      requiredSecrets: PORTAL_API_SA_REQUIRED_SECRETS,
      optionalSecrets: PORTAL_API_SA_OPTIONAL_SECRETS,
    });
  }

  if (normalizedAdminSa) {
    bindScopedRuntimeServiceAccount(scopedContext, {
      serviceAccount: normalizedAdminSa,
      requiredSecrets: ADMIN_SA_ALLOWED_SECRETS,
      invokerServices: ['admin-api', 'portal-api', 'ai-ask', 'cadence-demo'],
    });
  }

  if (normalizedAdminApiSa) {
    bindScopedRuntimeServiceAccount(scopedContext, {
      serviceAccount: normalizedAdminApiSa,
      requiredSecrets: ADMIN_API_SA_REQUIRED_SECRETS,
      optionalSecrets: ADMIN_API_SA_OPTIONAL_SECRETS,
      invokerServices: ['ai-ask'],
    });
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
