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

describe.skipIf(!ownerDatabaseUrl || !portalDatabaseUrl)(
  'PostgreSQL 19 migration 0011_portal_app_grants_and_rls apply -> rollback -> reapply lifecycle',
  () => {
    let ownerPool: Pool;

    beforeAll(() => {
      ownerPool = createDbPool(ownerDatabaseUrl);
    });

    afterAll(async () => {
      await ownerPool.end();
    });

    it('applies 0011 from 0010 baseline, reapplies idempotently, rolls back twice, reapplies cleanly, guards missing drizzle schema, and fails loud without CREATEROLE', async () => {
      const drizzleDir = resolve(import.meta.dirname, '../drizzle');
      const up0011 = readFileSync(
        resolve(drizzleDir, '0011_portal_app_grants_and_rls.sql'),
        'utf8',
      );
      const down0011 = readFileSync(
        resolve(drizzleDir, '0011_portal_app_grants_and_rls.down.sql'),
        'utf8',
      );

      const tempPre0011Dir = createDrizzleSubsetDir(drizzleDir, 10, 'aklapper-pre0011-');
      const tempThrough0011Dir = createDrizzleSubsetDir(drizzleDir, 11, 'aklapper-through0011-');
      const isolatedDbName = `migration_0011_verify_${Date.now()}`;
      let isoOwnerPool: Pool | null = null;
      let isoPortalPool: Pool | null = null;

      await ownerPool.query(`CREATE DATABASE "${isolatedDbName}"`);

      try {
        isoOwnerPool = createDbPool(withDatabaseName(ownerDatabaseUrl!, isolatedDbName));
        isoPortalPool = createDbPool(withDatabaseName(portalDatabaseUrl!, isolatedDbName));
        ignoreAdminShutdownPoolError(isoOwnerPool);
        ignoreAdminShutdownPoolError(isoPortalPool);

        const isoDb = createDb(isoOwnerPool);

        // 1. Pre-0011 baseline (0000..0010): no RLS, no portal_app grants.
        await runMigrations(isoDb, tempPre0011Dir);
        expect(await readRateLimitBucketsRlsState(isoOwnerPool)).toEqual({
          rlsEnabled: false,
          rlsForced: false,
          policies: [],
        });
        await expectSqlState(isoPortalPool.query('SELECT key FROM site_content LIMIT 1'), '42501');

        // 2. Apply 0011 via Drizzle migrator + verify idempotent SQL re-execution.
        await runMigrations(isoDb, tempThrough0011Dir);
        await isoOwnerPool.query(up0011);
        expect(await readRateLimitBucketsRlsState(isoOwnerPool)).toEqual({
          rlsEnabled: true,
          rlsForced: false,
          policies: [
            'rate_limit_buckets_portal_insert',
            'rate_limit_buckets_portal_select',
            'rate_limit_buckets_portal_update',
          ],
        });
        await expect(
          isoPortalPool.query('SELECT key FROM site_content LIMIT 1'),
        ).resolves.toBeDefined();

        // 3. Roll back 0011 twice (complete reversal + idempotency).
        await isoOwnerPool.query(down0011);
        await isoOwnerPool.query(down0011);
        expect(await readRateLimitBucketsRlsState(isoOwnerPool)).toEqual({
          rlsEnabled: false,
          rlsForced: false,
          policies: [],
        });
        await expectSqlState(isoPortalPool.query('SELECT key FROM site_content LIMIT 1'), '42501');
        await expectSqlState(
          isoPortalPool.query('INSERT INTO contact_submissions DEFAULT VALUES'),
          '42501',
        );

        // 4. Reapply 0011 cleanly and confirm grants & RLS restore completely.
        await isoOwnerPool.query(up0011);
        expect(await readRateLimitBucketsRlsState(isoOwnerPool)).toEqual({
          rlsEnabled: true,
          rlsForced: false,
          policies: [
            'rate_limit_buckets_portal_insert',
            'rate_limit_buckets_portal_select',
            'rate_limit_buckets_portal_update',
          ],
        });
        await expect(
          isoPortalPool.query('SELECT key FROM site_content LIMIT 1'),
        ).resolves.toBeDefined();

        // 5. Verify IF EXISTS guard around REVOKE ALL ON SCHEMA drizzle when schema drizzle is absent.
        await verifyDrizzleSchemaAbsenceGuard(isoOwnerPool, up0011, down0011);

        // 6. Verify 0011 precondition block: superuser auto-creates NOLOGIN role; non-CREATEROLE fails loud.
        await verifyMigrationRolePreconditionBlock(isoOwnerPool, up0011, 'portal_app', {
          rolcanlogin: false,
          rolsuper: false,
          rolcreatedb: false,
          rolcreaterole: false,
          rolinherit: true,
          rolreplication: false,
          rolbypassrls: false,
        });
      } finally {
        if (isoPortalPool) {
          await isoPortalPool.end();
        }
        if (isoOwnerPool) {
          await isoOwnerPool.end();
        }
        await ownerPool.query(`DROP DATABASE IF EXISTS "${isolatedDbName}" WITH (FORCE)`);
        rmSync(tempPre0011Dir, { recursive: true, force: true });
        rmSync(tempThrough0011Dir, { recursive: true, force: true });
      }
    });
  },
);
