import { readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createDb, createDbPool, runMigrations } from '../src/index.ts';
import {
  createDrizzleSubsetDir,
  expectSqlState,
  ignoreAdminShutdownPoolError,
  readRateLimitBucketsRlsState,
  verifyDrizzleSchemaAbsenceGuard,
  verifyMigrationRolePreconditionBlock,
  withDatabaseName,
} from './pg-privilege-helpers.ts';

const ownerDatabaseUrl = process.env['TEST_DATABASE_URL'] ?? process.env['DATABASE_URL'];
const portalDatabaseUrl = process.env['PORTAL_DATABASE_URL'];
const adminDatabaseUrl = process.env['ADMIN_DATABASE_URL'];

async function readWebauthnFlagColumns(
  pool: Pool,
): Promise<Array<{ column_name: string; data_type: string; is_nullable: string }>> {
  const res = await pool.query<{
    column_name: string;
    data_type: string;
    is_nullable: string;
  }>(
    `SELECT column_name, data_type, is_nullable
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'webauthn_credentials'
       AND column_name IN ('backup_eligible', 'backup_state')
     ORDER BY column_name`,
  );
  return res.rows;
}

describe.skipIf(!ownerDatabaseUrl || !portalDatabaseUrl || !adminDatabaseUrl)(
  'PostgreSQL 19 migration 0012_admin_app_grants_and_webauthn_flags apply -> rollback -> reapply lifecycle',
  () => {
    let ownerPool: Pool;

    beforeAll(() => {
      ownerPool = createDbPool(ownerDatabaseUrl);
    });

    afterAll(async () => {
      await ownerPool.end();
    });

    it('applies 0012 from 0011 baseline, reapplies idempotently, rolls back twice preserving 0011 RLS, reapplies cleanly, guards missing drizzle schema, and fails loud without CREATEROLE', async () => {
      const drizzleDir = resolve(import.meta.dirname, '../drizzle');
      const up0012 = readFileSync(
        resolve(drizzleDir, '0012_admin_app_grants_and_webauthn_flags.sql'),
        'utf8',
      );
      const down0012 = readFileSync(
        resolve(drizzleDir, '0012_admin_app_grants_and_webauthn_flags.down.sql'),
        'utf8',
      );

      const tempPre0012Dir = createDrizzleSubsetDir(drizzleDir, 11, 'aklapper-pre0012-');
      const isolatedDbName = `migration_0012_verify_${Date.now()}`;
      let isoOwnerPool: Pool | null = null;
      let isoPortalPool: Pool | null = null;
      let isoAdminPool: Pool | null = null;

      await ownerPool.query(`CREATE DATABASE "${isolatedDbName}"`);

      try {
        isoOwnerPool = createDbPool(withDatabaseName(ownerDatabaseUrl!, isolatedDbName));
        isoPortalPool = createDbPool(withDatabaseName(portalDatabaseUrl!, isolatedDbName));
        isoAdminPool = createDbPool(withDatabaseName(adminDatabaseUrl!, isolatedDbName));
        ignoreAdminShutdownPoolError(isoOwnerPool);
        ignoreAdminShutdownPoolError(isoPortalPool);
        ignoreAdminShutdownPoolError(isoAdminPool);

        const isoDb = createDb(isoOwnerPool);

        // 1. Pre-0012 baseline (0000..0011): 0011 portal_app RLS active, no WebAuthn flags, no admin_app grants.
        await runMigrations(isoDb, tempPre0012Dir);
        expect(await readWebauthnFlagColumns(isoOwnerPool)).toEqual([]);
        expect(await readRateLimitBucketsRlsState(isoOwnerPool)).toEqual({
          rlsEnabled: true,
          rlsForced: false,
          policies: [
            'rate_limit_buckets_portal_insert',
            'rate_limit_buckets_portal_select',
            'rate_limit_buckets_portal_update',
          ],
        });
        await expectSqlState(isoAdminPool.query('SELECT key FROM site_content LIMIT 1'), '42501');
        await expectSqlState(
          isoAdminPool.query('SELECT scope_key FROM rate_limit_buckets LIMIT 1'),
          '42501',
        );

        // 2. Apply 0012 via Drizzle migrator + verify idempotent SQL re-execution.
        await runMigrations(isoDb);
        await isoOwnerPool.query(up0012);
        expect(await readWebauthnFlagColumns(isoOwnerPool)).toEqual([
          { column_name: 'backup_eligible', data_type: 'boolean', is_nullable: 'YES' },
          { column_name: 'backup_state', data_type: 'boolean', is_nullable: 'YES' },
        ]);
        expect(await readRateLimitBucketsRlsState(isoOwnerPool)).toEqual({
          rlsEnabled: true,
          rlsForced: false,
          policies: [
            'rate_limit_buckets_admin_all',
            'rate_limit_buckets_portal_insert',
            'rate_limit_buckets_portal_select',
            'rate_limit_buckets_portal_update',
          ],
        });
        await expect(
          isoAdminPool.query('SELECT key FROM site_content LIMIT 1'),
        ).resolves.toBeDefined();
        await expect(
          isoAdminPool.query('SELECT scope_key FROM rate_limit_buckets LIMIT 1'),
        ).resolves.toBeDefined();

        // 3. Roll back 0012 twice (complete reversal + idempotency) WITHOUT disabling 0011 RLS.
        await isoOwnerPool.query(down0012);
        await isoOwnerPool.query(down0012);
        expect(await readWebauthnFlagColumns(isoOwnerPool)).toEqual([]);
        expect(await readRateLimitBucketsRlsState(isoOwnerPool)).toEqual({
          rlsEnabled: true,
          rlsForced: false,
          policies: [
            'rate_limit_buckets_portal_insert',
            'rate_limit_buckets_portal_select',
            'rate_limit_buckets_portal_update',
          ],
        });
        await expectSqlState(isoAdminPool.query('SELECT key FROM site_content LIMIT 1'), '42501');
        await expectSqlState(
          isoAdminPool.query('SELECT scope_key FROM rate_limit_buckets LIMIT 1'),
          '42501',
        );
        await expectSqlState(
          isoAdminPool.query('SELECT user_id FROM totp_secrets LIMIT 1'),
          '42501',
        );

        // Confirm portal_app remains active and strictly RLS-confined after 0012 rollback.
        await isoOwnerPool.query(
          `INSERT INTO rate_limit_buckets (scope_key, window_start, turns_used, tokens_used)
           VALUES ('auth:login:post_down_0012', NOW(), 1, 0),
                  ('contact:ip:post_down_0012', NOW(), 1, 0)`,
        );
        const portalVisibleAfterDown = await isoPortalPool.query<{ scope_key: string }>(
          `SELECT scope_key FROM rate_limit_buckets ORDER BY scope_key`,
        );
        expect(portalVisibleAfterDown.rows.map(row => row.scope_key)).toEqual([
          'contact:ip:post_down_0012',
        ]);

        // 4. Reapply 0012 cleanly and confirm columns, grants, and admin_all RLS policy restore.
        await isoOwnerPool.query(up0012);
        expect(await readWebauthnFlagColumns(isoOwnerPool)).toEqual([
          { column_name: 'backup_eligible', data_type: 'boolean', is_nullable: 'YES' },
          { column_name: 'backup_state', data_type: 'boolean', is_nullable: 'YES' },
        ]);
        expect(await readRateLimitBucketsRlsState(isoOwnerPool)).toEqual({
          rlsEnabled: true,
          rlsForced: false,
          policies: [
            'rate_limit_buckets_admin_all',
            'rate_limit_buckets_portal_insert',
            'rate_limit_buckets_portal_select',
            'rate_limit_buckets_portal_update',
          ],
        });
        const adminVisibleAfterReapply = await isoAdminPool.query<{ scope_key: string }>(
          `SELECT scope_key FROM rate_limit_buckets ORDER BY scope_key`,
        );
        expect(adminVisibleAfterReapply.rows.map(row => row.scope_key)).toEqual([
          'auth:login:post_down_0012',
          'contact:ip:post_down_0012',
        ]);

        // 5. Verify IF EXISTS guard around REVOKE ALL ON SCHEMA drizzle when schema drizzle is absent.
        await verifyDrizzleSchemaAbsenceGuard(isoOwnerPool, up0012, down0012);

        // 6. Verify 0012 precondition block: superuser auto-creates NOLOGIN/NOINHERIT role; non-CREATEROLE fails loud.
        await verifyMigrationRolePreconditionBlock(isoOwnerPool, up0012, 'admin_app', {
          rolcanlogin: false,
          rolsuper: false,
          rolcreatedb: false,
          rolcreaterole: false,
          rolinherit: false,
          rolreplication: false,
          rolbypassrls: false,
        });
      } finally {
        if (isoAdminPool) {
          await isoAdminPool.end();
        }
        if (isoPortalPool) {
          await isoPortalPool.end();
        }
        if (isoOwnerPool) {
          await isoOwnerPool.end();
        }
        await ownerPool.query(`DROP DATABASE IF EXISTS "${isolatedDbName}" WITH (FORCE)`);
        rmSync(tempPre0012Dir, { recursive: true, force: true });
      }
    });
  },
);
