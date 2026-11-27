import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

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
  GCP_WIF_SERVICE_ACCOUNT: 'aklapper-deployer@games-424800.iam.gserviceaccount.com',
  GCP_CLOUDRUN_SERVICE_ACCOUNT: 'aklapper-cloudrun@games-424800.iam.gserviceaccount.com',
  GCP_MIGRATOR_SERVICE_ACCOUNT: 'aklapper-migrator@games-424800.iam.gserviceaccount.com',
  GCP_PG19_VM_SERVICE_ACCOUNT: 'aklapper-pg19-vm@games-424800.iam.gserviceaccount.com',
  DATABASE_URL: 'postgres://aklapper:super-db-pass@10.128.0.10:5432/aklapper?sslmode=disable',
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

  it('separates WIF secrets, optional GitHub secrets, Secret Manager credentials, and pure Cloud Run config vars', () => {
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
        MAXMIND_ACCOUNT_ID: '123456',
        MAXMIND_LICENSE_KEY: 'maxmind-license-secret-val',
        IAP_ACCESSOR_EMAIL: 'owner@example.com',
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
        'MAXMIND_ACCOUNT_ID',
        'MAXMIND_LICENSE_KEY',
      ]);
      expect(plan.skippedOptionalSecrets).toEqual([]);
      expect(plan.gcpSecrets.map(s => s.envKey)).not.toContain('MAXMIND_ACCOUNT_ID');
      expect(plan.gcpSecrets.map(s => s.envKey)).not.toContain('MAXMIND_LICENSE_KEY');
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
          'GCP_PG19_VM_SERVICE_ACCOUNT',
          'IAP_ACCESSOR_EMAIL',
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
      expect(resolveSecretId('QDRANT_API_KEY')).toBe('QDRANT_API_KEY');
      expect(resolveSecretId('AGENSI_API_KEY')).toBe('AGENSI_API_KEY');
      expect(warnSpy).not.toHaveBeenCalled();

      const minimalPlan = buildSyncPlan(VALID_BASE_ENV);
      expect(minimalPlan.missingRequired).toEqual([]);
      expect(minimalPlan.retiredKeys).toEqual([]);
      expect(minimalPlan.secrets.map(s => s.key)).toEqual([
        'GCP_WORKLOAD_IDENTITY_PROVIDER',
        'GCP_WIF_SERVICE_ACCOUNT',
      ]);
      expect(minimalPlan.skippedOptionalSecrets).toEqual([
        'QDRANT_API_KEY',
        'AGENSI_API_KEY',
        'AI_PRIVACY_DENYLIST',
        'DOSSIER_PRIVACY_DENYLIST',
        'MAXMIND_ACCOUNT_ID',
        'MAXMIND_LICENSE_KEY',
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

  it('rejects all 14 retired keys (including K8s/Cloud SQL/unauth admin/maintenance mode) and emits UNSOUND_CONDITION telemetry', () => {
    const logged: string[] = [];
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation((msg: unknown) => {
      logged.push(String(msg));
    });
    try {
      const plan = buildSyncPlan({
        ...VALID_BASE_ENV,
        DATABASE_URL:
          'postgres://postgres:REPLACE_ME_DB_PASSWORD@10.128.0.10:5432/aklapper?sslmode=disable',
        QDRANT_URL: 'https://cluster.example.qdrant.io',
        ADMIN_BOOTSTRAP_TOKEN: 'legacy-secret-do-not-print',
        AUTH_API_URL: 'https://auth.bgdkapis.us',
        ANALYTICS_API_URL: 'https://analytics.bgdkapis.us',
        CADENCE_ADMIN_URL: 'https://cadence-admin.bgdkapis.us',
        CONTACT_API_URL: 'https://contact.bgdkapis.us',
        CLOUD_RUN_ALLOW_UNAUTH_APIS: 'false',
        CLOUD_SQL_INSTANCE: 'games-424800:us-central1:aklapper',
        GKE_CLUSTER_NAME: 'aklapper-autopilot',
        GKE_CLUSTER_LOCATION: 'us-central1',
        GCP_GKE_WORKLOAD_SA: 'aklapper-gke@games-424800.iam.gserviceaccount.com',
        K8S_WATCH_URL: 'https://k8s-watch.bgdkapis.us',
        CLOUD_RUN_ALLOW_UNAUTH_ADMIN: 'false',
        VERTEX_THINKING_BUDGET: '0',
        PORTAL_MAINTENANCE_MODE: 'false',
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
        'CLOUD_SQL_INSTANCE',
        'GKE_CLUSTER_NAME',
        'GKE_CLUSTER_LOCATION',
        'GCP_GKE_WORKLOAD_SA',
        'K8S_WATCH_URL',
        'CLOUD_RUN_ALLOW_UNAUTH_ADMIN',
        'VERTEX_THINKING_BUDGET',
        'PORTAL_MAINTENANCE_MODE',
      ]);
      expect(plan.variables.map(v => v.key)).not.toContain('VERTEX_THINKING_BUDGET');
      expect(plan.variables.map(v => v.key)).not.toContain('PORTAL_MAINTENANCE_MODE');
      expect(plan.variables.map(v => v.key)).not.toContain('AUTH_API_URL');
      expect(plan.variables.map(v => v.key)).not.toContain('ANALYTICS_API_URL');
      expect(plan.variables.map(v => v.key)).not.toContain('CADENCE_ADMIN_URL');
      expect(plan.variables.map(v => v.key)).not.toContain('CONTACT_API_URL');
      expect(plan.variables.map(v => v.key)).not.toContain('CLOUD_RUN_ALLOW_UNAUTH_APIS');
      expect(logged.join('\n')).toContain('deploy.env_sync.invalid_input');
      expect(logged.join('\n')).toContain('tooling.env_sync.retired_key_rejected');
      expect(logged.join('\n')).toContain('UNSOUND_CONDITION');
      expect(logged.join('\n')).toContain('K8S_WATCH_URL');
      expect(logged.join('\n')).toContain('PORTAL_MAINTENANCE_MODE');
      expect(logged.join('\n')).not.toContain('legacy-secret-do-not-print');
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('rejects PORTAL_MAINTENANCE_MODE in non-dry-run CLI invocation and removes it from deployment manifests', () => {
    const logged: string[] = [];
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation((msg: unknown) => {
      logged.push(String(msg));
    });
    try {
      const plan = buildSyncPlan({
        ...VALID_BASE_ENV,
        PORTAL_MAINTENANCE_MODE: 'true',
      });
      expect(plan.retiredKeys).toEqual(['PORTAL_MAINTENANCE_MODE']);
      expect(plan.variables.map(v => v.key)).not.toContain('PORTAL_MAINTENANCE_MODE');
      const retiredEvent = logged
        .map(line => JSON.parse(line) as Record<string, unknown>)
        .find(entry => entry['event'] === 'tooling.env_sync.retired_key_rejected');
      expect(retiredEvent).toEqual({
        event: 'tooling.env_sync.retired_key_rejected',
        seam: 'UNSOUND_CONDITION',
        retiredKeys: ['PORTAL_MAINTENANCE_MODE'],
      });
    } finally {
      warnSpy.mockRestore();
    }

    const tmpDir = mkdtempSync(join(tmpdir(), 'sync-github-env-retired-'));
    try {
      const envFile = join(tmpDir, 'prod.env');
      const lines = Object.entries({ ...VALID_BASE_ENV, PORTAL_MAINTENANCE_MODE: 'false' }).map(
        ([k, v]) => `${k}=${v}`,
      );
      writeFileSync(envFile, lines.join('\n'), 'utf8');
      const scriptPath = resolve(import.meta.dirname, '../src/sync-github-env.ts');
      let stderr = '';
      let exitCode = 0;
      try {
        execFileSync(process.execPath, [scriptPath, '--file', envFile], {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
        });
      } catch (err) {
        const execErr = err as { status?: number; stderr?: string };
        exitCode = execErr.status ?? 1;
        stderr = execErr.stderr ?? '';
      }
      expect(exitCode).not.toBe(0);
      expect(stderr).toContain('Remove retired keys before syncing: PORTAL_MAINTENANCE_MODE');
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }

    const repoRoot = resolve(import.meta.dirname, '../../..');
    const workflow = readFileSync(resolve(repoRoot, '.github/workflows/cd-gcp.yml'), 'utf8');
    const envExample = readFileSync(resolve(repoRoot, '.env.example'), 'utf8');

    expect(envExample).not.toContain('PORTAL_MAINTENANCE_MODE');
    expect(workflow).not.toMatch(/PORTAL_MAINTENANCE_MODE\s*[:=]/);
    expect(workflow).toMatch(/--remove-env-vars=[^\n]*PORTAL_MAINTENANCE_MODE/);
  });

  it('versions Secret Manager credentials via stdin and binds minimal-privilege 4-SA + Direct IAP roles without Cloud SQL or GKE', () => {
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
      expect(infoLogs.join('\n')).not.toContain('admin-stdin-secret-value');
    } finally {
      infoSpy.mockRestore();
    }

    calls.length = 0;
    ensureRuntimeServiceAccountBindings({
      projectId: 'games-424800',
      projectNumber: '120904484903',
      region: 'us-central1',
      deployerSa: 'aklapper-deployer@games-424800.iam.gserviceaccount.com',
      runtimeSa: 'aklapper-cloudrun@games-424800.iam.gserviceaccount.com',
      migratorSa: 'aklapper-migrator@games-424800.iam.gserviceaccount.com',
      pg19VmSa: 'aklapper-pg19-vm@games-424800.iam.gserviceaccount.com',
      iapAccessorEmail: 'owner@example.com',
      dryRun: false,
      execGcloud: runner,
    });

    const renderedArgs = calls.map(c => c.args.join(' '));
    const joined = renderedArgs.join('\n');
    expect(joined).toContain('roles/run.invoker');
    expect(joined).toContain('roles/run.developer');
    expect(joined).toContain('roles/secretmanager.secretAccessor');
    expect(joined).toContain('roles/aiplatform.user');
    expect(joined).toContain('roles/logging.logWriter');
    expect(joined).toContain('roles/storage.objectCreator');
    expect(joined).toContain('gs://games-424800-pg19-backups');
    expect(joined).toContain('roles/iap.httpsResourceAccessor');
    expect(joined).toContain('service-120904484903@gcp-sa-iap.iam.gserviceaccount.com');
    expect(joined).not.toContain('roles/cloudsql.client');
    expect(joined).not.toContain('svc.id.goog');
  });

  it('fails closed when projectId or deployerSa is missing and succeeds when optional pg19VmSa is omitted', () => {
    const runner = vi.fn<(args: readonly string[], input?: string) => string>(() => '');
    expect(() =>
      ensureRuntimeServiceAccountBindings({
        projectId: 'games-424800',
        deployerSa: '   ',
        dryRun: true,
        execGcloud: runner,
      }),
    ).toThrow(/projectId and deployerSa are required/);
    expect(runner).not.toHaveBeenCalled();

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      ensureRuntimeServiceAccountBindings({
        projectId: 'games-424800',
        projectNumber: '120904484903',
        deployerSa: 'aklapper-deployer@games-424800.iam.gserviceaccount.com',
        runtimeSa: 'aklapper-cloudrun@games-424800.iam.gserviceaccount.com',
        migratorSa: 'aklapper-migrator@games-424800.iam.gserviceaccount.com',
        dryRun: true,
        execGcloud: runner,
      });
      expect(runner).not.toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalled();
    } finally {
      logSpy.mockRestore();
    }
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

    expect(() => parseSyncCliArgs(['--env', 'staging'])).toThrow(/production/);
  });

  it('wires optional GeoLite2 pre-build staging with conditional v6 cache and secret-free portal Dockerfile COPY', () => {
    const repoRoot = resolve(import.meta.dirname, '../../..');
    const workflow = readFileSync(resolve(repoRoot, '.github/workflows/cd-gcp.yml'), 'utf8');
    const dockerfile = readFileSync(resolve(repoRoot, 'apps/portal/portal/Dockerfile'), 'utf8');
    const gitignore = readFileSync(resolve(repoRoot, '.gitignore'), 'utf8');

    expect(gitignore).toContain('*.mmdb');
    expect(dockerfile).toContain(
      'COPY apps/portal/portal/data/geolite2 /prod/portal/data/geolite2',
    );
    expect(dockerfile).not.toContain('MAXMIND_');
    expect(workflow).toContain('actions/cache/restore@v6');
    expect(workflow).toContain('actions/cache/save@v6');
    expect(workflow).toContain("steps.geolite2-stage.outputs.geolite2_ready == 'true'");
    expect(workflow).toContain('MaxMind.com');
  });
});
