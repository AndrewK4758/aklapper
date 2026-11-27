import type { Pool, PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  createDbPool,
  DEFAULT_LOCAL_PORTAL_APP_PASSWORD,
  PORTAL_APP_ROLE_NAME,
  provisionPortalRole,
  resolvePortalAppPassword,
  runProvisionPortalRoleCli,
} from '../src/index.ts';
import { withCredentials } from './pg-privilege-helpers.ts';

const ownerDatabaseUrl = process.env['TEST_DATABASE_URL'] ?? process.env['DATABASE_URL'];
const portalDatabaseUrl = process.env['PORTAL_DATABASE_URL'];

describe('provision-portal-role unit contracts', () => {
  it('resolves portal_app password from PORTAL_DATABASE_URL, PORTAL_APP_PASSWORD, or local default and fails closed in production', () => {
    expect(
      resolvePortalAppPassword({
        PORTAL_DATABASE_URL:
          'postgres://portal_app:p%40ss%27w%5Crd%3B1@127.0.0.1:5432/aklapper?sslmode=disable',
      }),
    ).toBe("p@ss'w\\rd;1");

    expect(
      resolvePortalAppPassword({
        PORTAL_APP_PASSWORD: 'explicit-secret-password',
      }),
    ).toBe('explicit-secret-password');

    expect(resolvePortalAppPassword({ NODE_ENV: 'test' })).toBe(DEFAULT_LOCAL_PORTAL_APP_PASSWORD);
    expect(resolvePortalAppPassword({ APP_ENV: 'development' })).toBe(
      DEFAULT_LOCAL_PORTAL_APP_PASSWORD,
    );

    expect(() =>
      resolvePortalAppPassword({
        PORTAL_DATABASE_URL: 'not-a-url',
      }),
    ).toThrow(/valid PostgreSQL connection URL/);

    expect(() =>
      resolvePortalAppPassword({
        PORTAL_DATABASE_URL: 'postgres://postgres:postgres@127.0.0.1:5432/aklapper',
      }),
    ).toThrow(/must authenticate as role "portal_app"/);

    expect(() =>
      resolvePortalAppPassword({
        PORTAL_DATABASE_URL: 'postgres://:secret@127.0.0.1:5432/aklapper',
      }),
    ).toThrow(/must authenticate as role "portal_app"/);

    expect(() =>
      resolvePortalAppPassword({
        PORTAL_DATABASE_URL: 'postgres://portal_app@127.0.0.1:5432/aklapper',
      }),
    ).toThrow(/non-empty password/);

    expect(() =>
      resolvePortalAppPassword({
        APP_ENV: 'production',
      }),
    ).toThrow(/required when provisioning role "portal_app" in production/);

    expect(() =>
      resolvePortalAppPassword({
        NODE_ENV: 'production',
      }),
    ).toThrow(/required when provisioning role "portal_app" in production/);

    expect(() =>
      resolvePortalAppPassword({
        NODE_ENV: 'production',
        APP_ENV: '',
      }),
    ).toThrow(/required when provisioning role "portal_app" in production/);

    expect(() =>
      resolvePortalAppPassword({
        NODE_ENV: 'production',
        APP_ENV: 'development',
      }),
    ).toThrow(/required when provisioning role "portal_app" in production/);
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

    const secret = 'ultra-secret-portal-pw-42';
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    try {
      const result = await runProvisionPortalRoleCli({ pool, password: secret });
      expect(result).toEqual({ role: PORTAL_APP_ROLE_NAME, action: 'created' });

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
      expect(logged).toContain('db.provision_portal_role.execution');
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
      provisionPortalRole(
        { connect: vi.fn<() => Promise<PoolClient>>(async () => client) },
        { password: 'test-password' },
      ),
    ).rejects.toThrow('simulated insufficient privilege');

    expect(events).toEqual(['BEGIN', 'SELECT', 'SELECT', 'DO', 'ROLLBACK', 'release']);
  });
});

describe.skipIf(!ownerDatabaseUrl || !portalDatabaseUrl)(
  'provision-portal-role live PostgreSQL 19 verification',
  () => {
    let ownerPool: Pool;

    beforeAll(() => {
      ownerPool = createDbPool(ownerDatabaseUrl);
    });

    afterAll(async () => {
      await ownerPool.end();
    });

    it('provisions portal_app idempotently, safely escapes special-char passwords, and rejects non-CREATEROLE callers', async () => {
      const currentPassword = decodeURIComponent(new URL(portalDatabaseUrl!).password);
      const specialPassword = `p@ss'w\\rd;${Date.now()}!`;
      const probeRole = `non_createrole_probe_${Date.now()}`;
      const probePassword = `probe_pw_${Date.now()}`;
      const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      try {
        const updated = await runProvisionPortalRoleCli({
          pool: ownerPool,
          password: currentPassword,
        });
        expect(updated).toEqual({ role: 'portal_app', action: 'updated' });

        const roleFlags = await ownerPool.query<{
          rolcanlogin: boolean;
          rolsuper: boolean;
          rolcreatedb: boolean;
          rolcreaterole: boolean;
          rolreplication: boolean;
          rolbypassrls: boolean;
        }>(
          `SELECT rolcanlogin, rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls
           FROM pg_roles
           WHERE rolname = 'portal_app'`,
        );
        expect(roleFlags.rows).toEqual([
          {
            rolcanlogin: true,
            rolsuper: false,
            rolcreatedb: false,
            rolcreaterole: false,
            rolreplication: false,
            rolbypassrls: false,
          },
        ]);

        // Exercise live PostgreSQL format(%L) escaping for quotes/backslashes/semicolons in a rolled-back tx.
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
        const escaped = await provisionPortalRole(rollbackOnlyPool, { password: specialPassword });
        expect(escaped).toEqual({ role: 'portal_app', action: 'updated' });

        const loggedOut = [...infoSpy.mock.calls.flat(), ...errorSpy.mock.calls.flat()].join('\n');
        expect(loggedOut).not.toContain(currentPassword);
        expect(loggedOut).not.toContain(specialPassword);

        // Non-CREATEROLE role calling provisionPortalRole fails loud without leaking secrets.
        await ownerPool.query(
          `CREATE ROLE "${probeRole}" LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD '${probePassword}'`,
        );
        const unprivilegedPool = createDbPool(
          withCredentials(ownerDatabaseUrl!, probeRole, probePassword),
        );
        try {
          await expect(
            provisionPortalRole(unprivilegedPool, { password: 'never-leak-this-secret' }),
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
