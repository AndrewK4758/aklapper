import { describe, expect, it } from 'vitest';

import { buildSyncPlan, parseEnvFileContent, parseSyncCliArgs } from '../src/index.ts';

describe('@aklapper/tooling GitHub Actions environment sync script', () => {
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

  it('classifies secrets, required/optional vars, and flags placeholders', () => {
    const plan = buildSyncPlan({
      GCP_WORKLOAD_IDENTITY_PROVIDER:
        'projects/120904484903/locations/global/workloadIdentityPools/aklapper-pool/providers/github-actions',
      GCP_WIF_SERVICE_ACCOUNT: 'aklapper@games-424800.iam.gserviceaccount.com',
      DATABASE_URL:
        'postgres://postgres:REPLACE_ME_DB_PASSWORD@db.bgdkapis.us:5432/aklapper?sslmode=disable',
      INTERNAL_AUTH_SECRET: 'secret-1',
      TOTP_ENCRYPTION_KEY: 'secret-2',
      ANALYTICS_DAILY_SALT: 'secret-3',
      ADMIN_BOOTSTRAP_TOKEN: 'secret-4',
      GCP_PROJECT_ID: 'games-424800',
      GCP_REGION: 'us-central1',
      GAR_REPOSITORY: 'portfolio',
      PUBLIC_PORTAL_URL: 'https://andrew-k.us',
      GKE_CLUSTER_NAME: '',
    });

    expect(plan.missingRequired).toEqual([]);
    expect(plan.placeholderKeys).toEqual(['DATABASE_URL']);
    expect(plan.secrets.map(s => s.key)).toEqual([
      'GCP_WORKLOAD_IDENTITY_PROVIDER',
      'GCP_WIF_SERVICE_ACCOUNT',
      'INTERNAL_AUTH_SECRET',
      'TOTP_ENCRYPTION_KEY',
      'ANALYTICS_DAILY_SALT',
      'ADMIN_BOOTSTRAP_TOKEN',
    ]);
    expect(plan.variables.map(v => v.key)).toEqual([
      'GCP_PROJECT_ID',
      'GCP_REGION',
      'GAR_REPOSITORY',
      'PUBLIC_PORTAL_URL',
    ]);
    expect(plan.skippedOptionalVariables).toContain('GKE_CLUSTER_NAME');
  });

  it('parses CLI arguments with production default and rejects non-production environments', () => {
    expect(parseSyncCliArgs(['--', '--dry-run', '--bootstrap-wif'])).toEqual({
      env: 'production',
      filePath: '.env.gcp.production.local',
      repo: 'AndrewK4758/aklapper',
      dryRun: true,
      bootstrapWif: true,
    });

    expect(parseSyncCliArgs(['--env=production', '--file=/tmp/prod.env'])).toEqual({
      env: 'production',
      filePath: '/tmp/prod.env',
      repo: 'AndrewK4758/aklapper',
      dryRun: false,
      bootstrapWif: false,
    });

    expect(() => parseSyncCliArgs(['--env', 'staging'])).toThrow(/production/);
  });
});
