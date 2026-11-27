import { describe, expect, it } from 'vitest';

import {
  derivePortalDatabaseUrl,
  resolvePortalDatabaseUrl,
  shouldReuseExternalDatabase,
} from '../src/index.ts';
import { buildExternalPgChildEnv, parseEphemeralPgCliArgs } from '../src/run-with-ephemeral-pg.ts';

describe('@aklapper/tooling ephemeral PG19 harness helpers', () => {
  it('determines when to reuse an active or CI-managed database', () => {
    expect(shouldReuseExternalDatabase({})).toBe(false);
    expect(
      shouldReuseExternalDatabase({
        DATABASE_URL: 'postgres://postgres:postgres@127.0.0.1:5439/aklapper',
      }),
    ).toBe(false);
    expect(
      shouldReuseExternalDatabase({
        AKLAPPER_EPHEMERAL_PG_ACTIVE: '1',
        DATABASE_URL: 'postgres://postgres:postgres@127.0.0.1:55123/aklapper_test',
      }),
    ).toBe(true);
    expect(
      shouldReuseExternalDatabase({
        AKLAPPER_EXTERNAL_TEST_DB: '1',
        DATABASE_URL: 'postgres://postgres:postgres@127.0.0.1:5439/aklapper',
      }),
    ).toBe(true);
    expect(
      shouldReuseExternalDatabase({
        CI: 'true',
        DATABASE_URL: 'postgres://postgres:postgres@127.0.0.1:5439/aklapper',
      }),
    ).toBe(true);
    expect(
      shouldReuseExternalDatabase({
        CI: 'true',
      }),
    ).toBe(false);
  });

  it('parses CLI wrapper arguments and rejects malformed invocations', () => {
    expect(
      parseEphemeralPgCliArgs(['--label', 'e2e', '--', 'pnpm', 'exec', 'playwright', 'test']),
    ).toEqual({
      label: 'e2e',
      command: 'pnpm',
      args: ['exec', 'playwright', 'test'],
    });

    expect(parseEphemeralPgCliArgs(['--label=test', '--', 'vitest', 'run'])).toEqual({
      label: 'test',
      command: 'vitest',
      args: ['run'],
    });

    expect(parseEphemeralPgCliArgs(['--', 'echo', 'ok'])).toEqual({
      label: 'test',
      command: 'echo',
      args: ['ok'],
    });

    expect(() => parseEphemeralPgCliArgs(['--label', 'test'])).toThrow(/Usage:/);
    expect(() => parseEphemeralPgCliArgs(['--unknown', '--', 'echo'])).toThrow(/Unknown option/);
  });

  it('derives and resolves least-privilege PORTAL_DATABASE_URL from DATABASE_URL cleanly', () => {
    expect(
      derivePortalDatabaseUrl(
        'postgres://postgres:postgres@127.0.0.1:55123/aklapper_test?sslmode=disable',
        's3cr3t@pass/1',
      ),
    ).toBe('postgres://portal_app:s3cr3t%40pass%2F1@127.0.0.1:55123/aklapper_test?sslmode=disable');

    expect(() => derivePortalDatabaseUrl('   ')).toThrow(/DATABASE_URL is required/);
    expect(() =>
      derivePortalDatabaseUrl('postgres://postgres:postgres@127.0.0.1:5432/aklapper', '  '),
    ).toThrow(/non-empty password/);

    expect(
      resolvePortalDatabaseUrl({
        DATABASE_URL: 'postgres://postgres:postgres@127.0.0.1:5432/aklapper?sslmode=disable',
      }),
    ).toBe(
      'postgres://portal_app:portal_app_local_dev_password@127.0.0.1:5432/aklapper?sslmode=disable',
    );

    expect(
      resolvePortalDatabaseUrl({
        DATABASE_URL: 'postgres://postgres:postgres@127.0.0.1:5432/aklapper',
        PORTAL_DATABASE_URL: 'postgres://portal_app:explicit_ci_pw@127.0.0.1:5432/aklapper',
      }),
    ).toBe('postgres://portal_app:explicit_ci_pw@127.0.0.1:5432/aklapper');

    expect(resolvePortalDatabaseUrl({})).toBeUndefined();

    const derivedExternalEnv = buildExternalPgChildEnv({
      CI: 'true',
      DATABASE_URL: 'postgres://postgres:postgres@127.0.0.1:5432/aklapper_ci?sslmode=disable',
    });
    expect(derivedExternalEnv['PORTAL_DATABASE_URL']).toBe(
      'postgres://portal_app:portal_app_local_dev_password@127.0.0.1:5432/aklapper_ci?sslmode=disable',
    );

    const preservedExternalEnv = buildExternalPgChildEnv({
      CI: 'true',
      DATABASE_URL: 'postgres://postgres:postgres@127.0.0.1:5432/aklapper_ci',
      PORTAL_DATABASE_URL: 'postgres://portal_app:custom_pw@127.0.0.1:5432/aklapper_ci',
    });
    expect(preservedExternalEnv['PORTAL_DATABASE_URL']).toBe(
      'postgres://portal_app:custom_pw@127.0.0.1:5432/aklapper_ci',
    );
  });
});
