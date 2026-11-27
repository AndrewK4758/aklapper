import { describe, expect, it } from 'vitest';

import {
  deriveAdminDatabaseUrl,
  derivePortalDatabaseUrl,
  resolveAdminDatabaseUrl,
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

  it.each([
    {
      role: 'portal_app',
      urlEnvVar: 'PORTAL_DATABASE_URL',
      defaultPassword: 'portal_app_local_dev_password',
      derive: derivePortalDatabaseUrl,
      resolve: resolvePortalDatabaseUrl,
    },
    {
      role: 'admin_app',
      urlEnvVar: 'ADMIN_DATABASE_URL',
      defaultPassword: 'admin_app_local_dev_password',
      derive: deriveAdminDatabaseUrl,
      resolve: resolveAdminDatabaseUrl,
    },
  ])(
    'derives and resolves least-privilege $urlEnvVar from DATABASE_URL cleanly',
    ({ role, urlEnvVar, defaultPassword, derive, resolve }) => {
      expect(
        derive(
          'postgres://postgres:postgres@127.0.0.1:55123/aklapper_test?sslmode=disable',
          's3cr3t@pass/1',
        ),
      ).toBe(`postgres://${role}:s3cr3t%40pass%2F1@127.0.0.1:55123/aklapper_test?sslmode=disable`);

      expect(() => derive('   ')).toThrow(/DATABASE_URL is required/);
      expect(() => derive('postgres://postgres:postgres@127.0.0.1:5432/aklapper', '  ')).toThrow(
        /non-empty password/,
      );

      expect(
        resolve({
          DATABASE_URL: 'postgres://postgres:postgres@127.0.0.1:5432/aklapper?sslmode=disable',
        }),
      ).toBe(`postgres://${role}:${defaultPassword}@127.0.0.1:5432/aklapper?sslmode=disable`);

      expect(
        resolve({
          DATABASE_URL: 'postgres://postgres:postgres@127.0.0.1:5432/aklapper',
          [urlEnvVar]: `postgres://${role}:explicit_ci_pw@127.0.0.1:5432/aklapper`,
        }),
      ).toBe(`postgres://${role}:explicit_ci_pw@127.0.0.1:5432/aklapper`);

      expect(resolve({})).toBeUndefined();

      const derivedExternalEnv = buildExternalPgChildEnv({
        CI: 'true',
        DATABASE_URL: 'postgres://postgres:postgres@127.0.0.1:5432/aklapper_ci?sslmode=disable',
      });
      expect(derivedExternalEnv[urlEnvVar]).toBe(
        `postgres://${role}:${defaultPassword}@127.0.0.1:5432/aklapper_ci?sslmode=disable`,
      );

      const preservedExternalEnv = buildExternalPgChildEnv({
        CI: 'true',
        DATABASE_URL: 'postgres://postgres:postgres@127.0.0.1:5432/aklapper_ci',
        [urlEnvVar]: `postgres://${role}:custom_pw@127.0.0.1:5432/aklapper_ci`,
      });
      expect(preservedExternalEnv[urlEnvVar]).toBe(
        `postgres://${role}:custom_pw@127.0.0.1:5432/aklapper_ci`,
      );
    },
  );
});
