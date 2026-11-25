import { describe, expect, it, vi } from 'vitest';

import {
  buildSyncPlan,
  ensureRuntimeServiceAccountBindings,
  parseEnvFileContent,
  parseSyncCliArgs,
  resolveSecretId,
  syncGcpSecretVersions,
} from '../src/index.ts';

const VALID_BASE_ENV: Record<string, string> = {
  GCP_WORKLOAD_IDENTITY_PROVIDER:
    'projects/120904484903/locations/global/workloadIdentityPools/aklapper-pool/providers/github-actions',
  GCP_WIF_SERVICE_ACCOUNT: 'aklapper@games-424800.iam.gserviceaccount.com',
  GCP_CLOUDRUN_SERVICE_ACCOUNT: 'aklapper-runtime@games-424800.iam.gserviceaccount.com',
  GCP_MIGRATOR_SERVICE_ACCOUNT: 'aklapper-migrator@games-424800.iam.gserviceaccount.com',
  GCP_GKE_WORKLOAD_SA: 'aklapper-gke@games-424800.iam.gserviceaccount.com',
  DATABASE_URL:
    'postgres://postgres:super-db-pass@localhost/aklapper?host=/cloudsql/games-424800:us-central1:aklapper',
  INTERNAL_AUTH_SECRET: 'internal-secret-val',
  TOTP_ENCRYPTION_KEY: 'totp-key-val',
  ANALYTICS_DAILY_SALT: 'analytics-salt-val',
  GCP_PROJECT_ID: 'games-424800',
  GCP_REGION: 'us-central1',
  GCP_LOCATION: 'global',
  GAR_REPOSITORY: 'portfolio',
  AI_PROVIDER: 'vertex',
  VERTEX_MODEL: 'gemini-3.8-flash',
  VERTEX_EMBED_MODEL: 'gemini-embedding-2',
  PUBLIC_PORTAL_URL: 'https://andrew-k.us',
  GKE_CLUSTER_NAME: '',
};

describe('@aklapper/tooling GitHub Actions and GCP Secret Manager sync', () => {
  it('parses env files with comments, blank lines, and quoted values', () => {
    const parsed = parseEnvFileContent(`
      # Comment line
      GCP_PROJECT_ID=games-424800
      WEBAUTHN_RP_NAME="andrew-k.us Admin"
      EMPTY_VAL=
      SINGLE_QUOTED='us-central1'
    `);

    expect(parsed).toEqual({
      GCP_PROJECT_ID: 'games-424800',
      WEBAUTHN_RP_NAME: 'andrew-k.us Admin',
      EMPTY_VAL: '',
      SINGLE_QUOTED: 'us-central1',
    });
  });

  it('separates WIF secrets, optional GitHub secrets, Secret Manager credentials, and Vertex/Agensi/SA config vars without retired bootstrap tokens', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const plan = buildSyncPlan({
        ...VALID_BASE_ENV,
        QDRANT_URL: 'https://cluster.example.qdrant.io',
        QDRANT_API_KEY: 'qdrant-secret-val',
        AGENSI_API_BASE_URL: 'https://www.agensi.io',
        AGENSI_API_PATH: '/creators/aklapper',
        AGENSI_CREATOR_HANDLE: 'aklapper',
        AGENSI_SYNC_DISABLED: 'false',
        AGENSI_API_KEY: 'agensi-secret-val',
        AI_PRIVACY_DENYLIST: '["Synthetic-Test-Term"]',
        VERTEX_THINKING_LEVEL: 'LOW',
        AGENSI_CACHE_TTL_SECONDS: '300',
        AGENSI_FETCH_TIMEOUT_MS: '1800',
        ADMIN_HANDLE: 'admin',
        ADMIN_PASSWORD: 'admin-password-val',
        DOSSIER_PRIVACY_DENYLIST: 'WyJTeW50aGV0aWNDbGllbnRYIl0=',
      });

      expect(plan.missingRequired).toEqual([]);
      expect(plan.placeholderKeys).toEqual([]);
      expect(plan.retiredKeys).toEqual([]);
      expect(plan.secrets.map(s => s.key)).toEqual([
        'GCP_WORKLOAD_IDENTITY_PROVIDER',
        'GCP_WIF_SERVICE_ACCOUNT',
        'QDRANT_API_KEY',
        'AGENSI_API_KEY',
        'AI_PRIVACY_DENYLIST',
        'DOSSIER_PRIVACY_DENYLIST',
      ]);
      expect(plan.skippedOptionalSecrets).toEqual([]);
      expect(plan.gcpSecrets.map(s => s.envKey)).toEqual([
        'DATABASE_URL',
        'INTERNAL_AUTH_SECRET',
        'TOTP_ENCRYPTION_KEY',
        'ANALYTICS_DAILY_SALT',
        'QDRANT_API_KEY',
        'ADMIN_PASSWORD',
        'AGENSI_API_KEY',
        'AI_PRIVACY_DENYLIST',
        'DOSSIER_PRIVACY_DENYLIST',
      ]);
      expect(plan.variables.map(v => v.key)).toEqual(
        expect.arrayContaining([
          'GCP_PROJECT_ID',
          'GCP_REGION',
          'GAR_REPOSITORY',
          'AI_PROVIDER',
          'GCP_LOCATION',
          'VERTEX_MODEL',
          'VERTEX_THINKING_LEVEL',
          'VERTEX_EMBED_MODEL',
          'ADMIN_HANDLE',
          'GCP_CLOUDRUN_SERVICE_ACCOUNT',
          'GCP_MIGRATOR_SERVICE_ACCOUNT',
          'GCP_GKE_WORKLOAD_SA',
          'QDRANT_URL',
          'AGENSI_API_BASE_URL',
          'AGENSI_API_PATH',
          'AGENSI_CREATOR_HANDLE',
          'AGENSI_SYNC_DISABLED',
          'AGENSI_CACHE_TTL_SECONDS',
          'AGENSI_FETCH_TIMEOUT_MS',
        ]),
      );
      expect(plan.variables.map(v => v.key)).not.toContain('QDRANT_API_KEY');
      expect(plan.variables.map(v => v.key)).not.toContain('AGENSI_API_KEY');
      expect(plan.skippedOptionalVariables).toContain('GKE_CLUSTER_NAME');
      expect(resolveSecretId('QDRANT_API_KEY')).toBe('QDRANT_API_KEY');
      expect(resolveSecretId('AGENSI_API_KEY')).toBe('AGENSI_API_KEY');
      expect(warnSpy).not.toHaveBeenCalled();

      const minimalPlan = buildSyncPlan(VALID_BASE_ENV);
      expect(minimalPlan.missingRequired).toEqual([]);
      expect(minimalPlan.secrets.map(s => s.key)).toEqual([
        'GCP_WORKLOAD_IDENTITY_PROVIDER',
        'GCP_WIF_SERVICE_ACCOUNT',
      ]);
      expect(minimalPlan.skippedOptionalSecrets).toEqual([
        'QDRANT_API_KEY',
        'AGENSI_API_KEY',
        'AI_PRIVACY_DENYLIST',
        'DOSSIER_PRIVACY_DENYLIST',
      ]);
      expect(minimalPlan.skippedOptionalVariables).toContain('VERTEX_THINKING_LEVEL');
      expect(minimalPlan.gcpSecrets.map(s => s.envKey)).toEqual([
        'DATABASE_URL',
        'INTERNAL_AUTH_SECRET',
        'TOTP_ENCRYPTION_KEY',
        'ANALYTICS_DAILY_SALT',
      ]);
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('flags retired keys, placeholders, and missing QDRANT_API_KEY for HTTPS Qdrant via UNSOUND_CONDITION telemetry', () => {
    const logged: string[] = [];
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation((msg: unknown) => {
      logged.push(String(msg));
    });
    try {
      const plan = buildSyncPlan({
        ...VALID_BASE_ENV,
        DATABASE_URL:
          'postgres://postgres:REPLACE_ME_DB_PASSWORD@db.bgdkapis.us:5432/aklapper?sslmode=disable',
        QDRANT_URL: 'https://cluster.example.qdrant.io',
        ADMIN_BOOTSTRAP_TOKEN: 'legacy-secret-do-not-print',
        AUTH_API_URL: 'https://auth.bgdkapis.us',
        ANALYTICS_API_URL: 'https://analytics.bgdkapis.us',
        CADENCE_ADMIN_URL: 'https://cadence-admin.bgdkapis.us',
        CONTACT_API_URL: 'https://contact.bgdkapis.us',
        CLOUD_RUN_ALLOW_UNAUTH_APIS: 'false',
        VERTEX_THINKING_BUDGET: '0',
      });

      expect(plan.placeholderKeys).toEqual(['DATABASE_URL']);
      expect(plan.missingRequired).toEqual(['QDRANT_API_KEY']);
      expect(plan.retiredKeys).toEqual([
        'ADMIN_BOOTSTRAP_TOKEN',
        'AUTH_API_URL',
        'ANALYTICS_API_URL',
        'CADENCE_ADMIN_URL',
        'CONTACT_API_URL',
        'CLOUD_RUN_ALLOW_UNAUTH_APIS',
        'VERTEX_THINKING_BUDGET',
      ]);
      expect(plan.variables.map(v => v.key)).not.toContain('VERTEX_THINKING_BUDGET');
      expect(plan.variables.map(v => v.key)).not.toContain('AUTH_API_URL');
      expect(plan.variables.map(v => v.key)).not.toContain('ANALYTICS_API_URL');
      expect(plan.variables.map(v => v.key)).not.toContain('CADENCE_ADMIN_URL');
      expect(plan.variables.map(v => v.key)).not.toContain('CONTACT_API_URL');
      expect(plan.variables.map(v => v.key)).not.toContain('CLOUD_RUN_ALLOW_UNAUTH_APIS');
      expect(logged.join('\n')).toContain('deploy.env_sync.invalid_input');
      expect(logged.join('\n')).toContain('UNSOUND_CONDITION');
      expect(logged.join('\n')).toContain('QDRANT_API_KEY');
      expect(logged.join('\n')).toContain('ADMIN_BOOTSTRAP_TOKEN');
      expect(logged.join('\n')).toContain('AUTH_API_URL');
      expect(logged.join('\n')).not.toContain('legacy-secret-do-not-print');

      const placeholderSecretPlan = buildSyncPlan({
        ...VALID_BASE_ENV,
        QDRANT_API_KEY: 'PLACEHOLDER_REPLACE_ME',
      });
      expect(placeholderSecretPlan.placeholderKeys).toEqual(['QDRANT_API_KEY']);
      expect(placeholderSecretPlan.variables.map(v => v.key)).not.toContain('QDRANT_API_KEY');
      expect(placeholderSecretPlan.secrets.map(s => s.key)).not.toContain('QDRANT_API_KEY');
      expect(placeholderSecretPlan.gcpSecrets.map(s => s.envKey)).not.toContain('QDRANT_API_KEY');
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('versions Secret Manager credentials via stdin only and binds least-privilege runtime, migrator, and GKE WIF IAM roles', () => {
    const calls: Array<{ args: readonly string[]; input?: string }> = [];
    const runner = (args: readonly string[], input?: string): string => {
      calls.push({ args, input });
      if (args[0] === 'secrets' && args[1] === 'describe') {
        throw new Error('NOT_FOUND');
      }
      return '';
    };

    const infoLogs: string[] = [];
    const infoSpy = vi.spyOn(console, 'info').mockImplementation((msg: unknown) => {
      infoLogs.push(String(msg));
    });
    try {
      syncGcpSecretVersions(
        [
          {
            envKey: 'ADMIN_PASSWORD',
            secretId: 'ADMIN_PASSWORD',
            value: 'admin-stdin-secret-value',
          },
        ],
        'games-424800',
        false,
        runner,
      );
      expect(infoLogs.join('\n')).toContain('deploy.secret_sync.applied');
      expect(infoLogs.join('\n')).toContain('DELTA_AUDIT_GAP');
      expect(infoLogs.join('\n')).toContain('ADMIN_PASSWORD');
      expect(infoLogs.join('\n')).not.toContain('admin-stdin-secret-value');
    } finally {
      infoSpy.mockRestore();
    }

    expect(calls[0]?.args).toEqual([
      'secrets',
      'describe',
      'ADMIN_PASSWORD',
      '--project',
      'games-424800',
      '--format=value(name)',
    ]);
    expect(calls[1]?.args).toEqual([
      'secrets',
      'create',
      'ADMIN_PASSWORD',
      '--project',
      'games-424800',
      '--replication-policy=automatic',
    ]);
    expect(calls[2]?.args).toEqual([
      'secrets',
      'versions',
      'add',
      'ADMIN_PASSWORD',
      '--project',
      'games-424800',
      '--data-file=-',
    ]);
    expect(calls[2]?.args.join(' ')).not.toContain('admin-stdin-secret-value');
    expect(calls[2]?.input).toBe('admin-stdin-secret-value');

    calls.length = 0;
    ensureRuntimeServiceAccountBindings({
      projectId: 'games-424800',
      deployerSa: 'aklapper@games-424800.iam.gserviceaccount.com',
      runtimeSa: 'aklapper-runtime@games-424800.iam.gserviceaccount.com',
      migratorSa: 'aklapper-migrator@games-424800.iam.gserviceaccount.com',
      gkeWorkloadSa: 'aklapper-gke@games-424800.iam.gserviceaccount.com',
      dryRun: false,
      execGcloud: runner,
    });

    const renderedArgs = calls.map(c => c.args.join(' '));
    expect(renderedArgs).toContain(
      'projects add-iam-policy-binding games-424800 --member=serviceAccount:aklapper@games-424800.iam.gserviceaccount.com --role=roles/run.invoker --condition=None',
    );
    expect(renderedArgs).toContain(
      'projects add-iam-policy-binding games-424800 --member=serviceAccount:aklapper-runtime@games-424800.iam.gserviceaccount.com --role=roles/run.invoker --condition=None',
    );
    expect(renderedArgs).toContain(
      'projects add-iam-policy-binding games-424800 --member=serviceAccount:aklapper-runtime@games-424800.iam.gserviceaccount.com --role=roles/aiplatform.user --condition=None',
    );
    expect(renderedArgs).toContain(
      'iam service-accounts add-iam-policy-binding aklapper-runtime@games-424800.iam.gserviceaccount.com --project=games-424800 --role=roles/iam.serviceAccountUser --member=serviceAccount:aklapper@games-424800.iam.gserviceaccount.com',
    );
    expect(renderedArgs).toContain(
      'iam service-accounts add-iam-policy-binding aklapper-migrator@games-424800.iam.gserviceaccount.com --project=games-424800 --role=roles/iam.serviceAccountUser --member=serviceAccount:aklapper@games-424800.iam.gserviceaccount.com',
    );
    expect(renderedArgs).toContain(
      'iam service-accounts add-iam-policy-binding aklapper-gke@games-424800.iam.gserviceaccount.com --project=games-424800 --role=roles/iam.workloadIdentityUser --member=serviceAccount:games-424800.svc.id.goog[portfolio-public/ai-ask]',
    );
    expect(renderedArgs).toContain(
      'iam service-accounts add-iam-policy-binding aklapper-gke@games-424800.iam.gserviceaccount.com --project=games-424800 --role=roles/iam.workloadIdentityUser --member=serviceAccount:games-424800.svc.id.goog[portfolio-public/cadence-demo]',
    );
    expect(renderedArgs.join('\n')).not.toContain('cadence-admin/cadence-admin');
  });

  it('parses CLI arguments with production default and rejects non-production environments', () => {
    expect(parseSyncCliArgs(['--', '--dry-run', '--bootstrap-wif', '--skip-gcp-secrets'])).toEqual({
      env: 'production',
      filePath: '.env.gcp.production.local',
      repo: 'AndrewK4758/aklapper',
      dryRun: true,
      bootstrapWif: true,
      skipGcpSecrets: true,
    });

    expect(parseSyncCliArgs(['--env=production', '--file=/tmp/prod.env'])).toEqual({
      env: 'production',
      filePath: '/tmp/prod.env',
      repo: 'AndrewK4758/aklapper',
      dryRun: false,
      bootstrapWif: false,
      skipGcpSecrets: false,
    });

    expect(() => parseSyncCliArgs(['--env', 'staging'])).toThrow(/production/);
  });
});
