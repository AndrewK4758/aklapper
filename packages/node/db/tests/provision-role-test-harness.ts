import type { Pool, PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { createDbPool } from '../src/index.ts';
import type {
  ProvisionAppRoleOptions,
  ProvisionAppRoleResult,
  RunProvisionAppRoleCliOptions,
} from '../src/provision-role-common.ts';
import {
  readRoleCatalogFlags,
  type RoleCatalogFlags,
  withCredentials,
} from './pg-privilege-helpers.ts';

export interface RoleProvisionTestSpec<TRole extends string> {
  readonly suitePrefix: string;
  readonly roleName: TRole;
  readonly urlEnvVar: string;
  readonly passwordEnvVar: string;
  readonly defaultLocalPassword: string;
  readonly logEventName: string;
  readonly expectedLiveFlags: RoleCatalogFlags;
  readonly ownerDatabaseUrl: string | undefined;
  readonly roleDatabaseUrl: string | undefined;
  readonly resolvePassword: (env?: Readonly<Record<string, string | undefined>>) => string;
  readonly provisionRole: (
    pool: Pick<Pool, 'connect'>,
    options?: ProvisionAppRoleOptions,
  ) => Promise<ProvisionAppRoleResult<TRole>>;
  readonly runCli: (
    options?: RunProvisionAppRoleCliOptions,
  ) => Promise<ProvisionAppRoleResult<TRole>>;
}

export function registerRoleProvisionTestSuites<TRole extends string>(
  spec: RoleProvisionTestSpec<TRole>,
): void {
  describe(`${spec.suitePrefix} unit contracts`, () => {
    it(`resolves ${spec.roleName} password from ${spec.urlEnvVar}, ${spec.passwordEnvVar}, or local default and fails closed in production`, () => {
      expect(
        spec.resolvePassword({
          [spec.urlEnvVar]: `postgres://${spec.roleName}:p%40ss%27w%5Crd%3B1@127.0.0.1:5432/aklapper?sslmode=disable`,
        }),
      ).toBe("p@ss'w\\rd;1");

      expect(
        spec.resolvePassword({
          [spec.passwordEnvVar]: 'explicit-secret-password',
        }),
      ).toBe('explicit-secret-password');

      expect(spec.resolvePassword({ NODE_ENV: 'test' })).toBe(spec.defaultLocalPassword);
      expect(spec.resolvePassword({ APP_ENV: 'development' })).toBe(spec.defaultLocalPassword);

      expect(() =>
        spec.resolvePassword({
          [spec.urlEnvVar]: 'not-a-url',
        }),
      ).toThrow(/valid PostgreSQL connection URL/);

      expect(() =>
        spec.resolvePassword({
          [spec.urlEnvVar]: 'postgres://postgres:postgres@127.0.0.1:5432/aklapper',
        }),
      ).toThrow(new RegExp(`must authenticate as role "${spec.roleName}"`));

      expect(() =>
        spec.resolvePassword({
          [spec.urlEnvVar]: 'postgres://:secret@127.0.0.1:5432/aklapper',
        }),
      ).toThrow(new RegExp(`must authenticate as role "${spec.roleName}"`));

      expect(() =>
        spec.resolvePassword({
          [spec.urlEnvVar]: `postgres://${spec.roleName}@127.0.0.1:5432/aklapper`,
        }),
      ).toThrow(/non-empty password/);

      const prodRequiredRe = new RegExp(
        `required when provisioning role "${spec.roleName}" in production`,
      );
      expect(() => spec.resolvePassword({ APP_ENV: 'production' })).toThrow(prodRequiredRe);
      expect(() => spec.resolvePassword({ NODE_ENV: 'production' })).toThrow(prodRequiredRe);
      expect(() => spec.resolvePassword({ NODE_ENV: 'production', APP_ENV: '' })).toThrow(
        prodRequiredRe,
      );
      expect(() =>
        spec.resolvePassword({ NODE_ENV: 'production', APP_ENV: 'development' }),
      ).toThrow(prodRequiredRe);
    });

    it('executes role provisioning inside a transaction using set_config without embedding secrets in SQL or logs', async () => {
      const queries: Array<{ sql: string; params?: readonly unknown[] }> = [];
      const client = {
        query: vi.fn<
          (
            sql: string,
            params?: readonly unknown[],
          ) => Promise<{ rows: Array<{ existed?: boolean }> }>
        >(async (sql, params) => {
          queries.push({ sql, ...(params ? { params } : {}) });
          if (sql.includes('FROM pg_roles WHERE rolname = $1')) {
            return { rows: [{ existed: false }] };
          }
          return { rows: [] };
        }),
        release: vi.fn<() => void>(),
      } as unknown as PoolClient;

      const pool = {
        connect: vi.fn<() => Promise<PoolClient>>(async () => client),
        end: vi.fn<() => Promise<void>>(async () => undefined),
      } as unknown as Pool;

      const secret = `ultra-secret-${spec.roleName}-pw-42`;
      const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
      try {
        const result = await spec.runCli({ pool, password: secret });
        expect(result).toEqual({ role: spec.roleName, action: 'created' });

        expect(queries.map(q => q.sql.trim().split(/\s+/)[0])).toEqual([
          'BEGIN',
          'SELECT',
          'SELECT',
          'DO',
          'SELECT',
          'COMMIT',
        ]);
        for (const entry of queries) {
          expect(entry.sql).not.toContain(secret);
        }
        expect(queries[2]?.params).toEqual([secret]);
        expect(queries[4]?.params).toBeUndefined();

        const logged = infoSpy.mock.calls.flat().join('\n');
        expect(logged).toContain(spec.logEventName);
        expect(logged).not.toContain(secret);
      } finally {
        infoSpy.mockRestore();
      }
    });

    it('rolls back cleanly and releases the client when role provisioning fails', async () => {
      const events: string[] = [];
      const client = {
        query: vi.fn<(sql: string) => Promise<{ rows: unknown[] }>>(async sql => {
          events.push(sql.trim().split(/\s+/)[0] ?? '');
          if (sql.includes('DO $$')) {
            throw new Error('simulated insufficient privilege');
          }
          return { rows: [{ existed: true }] };
        }),
        release: vi.fn<() => void>(() => {
          events.push('release');
        }),
      } as unknown as PoolClient;

      await expect(
        spec.provisionRole(
          { connect: vi.fn<() => Promise<PoolClient>>(async () => client) },
          { password: 'test-password' },
        ),
      ).rejects.toThrow('simulated insufficient privilege');

      expect(events).toEqual(['BEGIN', 'SELECT', 'SELECT', 'DO', 'ROLLBACK', 'release']);
    });
  });

  describe.skipIf(!spec.ownerDatabaseUrl || !spec.roleDatabaseUrl)(
    `${spec.suitePrefix} live PostgreSQL 19 verification`,
    () => {
      let ownerPool: Pool;

      beforeAll(() => {
        ownerPool = createDbPool(spec.ownerDatabaseUrl);
      });

      afterAll(async () => {
        await ownerPool.end();
      });

      it(`provisions ${spec.roleName} idempotently, safely escapes special-char passwords, and rejects non-CREATEROLE callers`, async () => {
        const currentPassword = decodeURIComponent(new URL(spec.roleDatabaseUrl!).password);
        const specialPassword = `p@ss'w\\rd;${Date.now()}!`;
        const probeRole = `nocr_${spec.roleName}_${Date.now()}`;
        const probePassword = `probe_pw_${Date.now()}`;
        const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

        try {
          const updated = await spec.runCli({
            pool: ownerPool,
            password: currentPassword,
          });
          expect(updated).toEqual({ role: spec.roleName, action: 'updated' });

          const roleFlags = await readRoleCatalogFlags(ownerPool, spec.roleName);
          expect(roleFlags).toEqual([spec.expectedLiveFlags]);

          const rollbackOnlyPool: Pick<Pool, 'connect'> = {
            connect: async () => {
              const rawClient = await ownerPool.connect();
              return {
                query: (sql: string, params?: readonly unknown[]) =>
                  rawClient.query(sql === 'COMMIT' ? 'ROLLBACK' : sql, params as unknown[]),
                release: (err?: Error | boolean) => rawClient.release(err),
              } as unknown as PoolClient;
            },
          };
          const escaped = await spec.provisionRole(rollbackOnlyPool, {
            password: specialPassword,
          });
          expect(escaped).toEqual({ role: spec.roleName, action: 'updated' });

          const loggedOut = [...infoSpy.mock.calls.flat(), ...errorSpy.mock.calls.flat()].join(
            '\n',
          );
          expect(loggedOut).not.toContain(currentPassword);
          expect(loggedOut).not.toContain(specialPassword);

          await ownerPool.query(
            `CREATE ROLE "${probeRole}" LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD '${probePassword}'`,
          );
          const unprivilegedPool = createDbPool(
            withCredentials(spec.ownerDatabaseUrl!, probeRole, probePassword),
          );
          try {
            await expect(
              spec.provisionRole(unprivilegedPool, { password: 'never-leak-this-secret' }),
            ).rejects.toThrow(/lacks CREATEROLE\/SUPERUSER/);
          } finally {
            await unprivilegedPool.end();
            await ownerPool.query(`DROP ROLE IF EXISTS "${probeRole}"`);
          }
        } finally {
          infoSpy.mockRestore();
          errorSpy.mockRestore();
        }
      });
    },
  );
}
