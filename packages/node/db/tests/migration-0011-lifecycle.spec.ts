import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createDb, createDbPool, runMigrations } from '../src/index.ts';
import { expectSqlState, withDatabaseName } from './pg-privilege-helpers.ts';

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
      const journalPath = resolve(drizzleDir, 'meta/_journal.json');
      const fullJournal = JSON.parse(readFileSync(journalPath, 'utf8')) as {
        version: string;
        dialect: string;
        entries: Array<{
          idx: number;
          version: string;
          when: number;
          tag: string;
          breakpoints: boolean;
        }>;
      };
      const up0011 = readFileSync(
        resolve(drizzleDir, '0011_portal_app_grants_and_rls.sql'),
        'utf8',
      );
      const down0011 = readFileSync(
        resolve(drizzleDir, '0011_portal_app_grants_and_rls.down.sql'),
        'utf8',
      );

      const tempPre0011Dir = mkdtempSync(resolve(tmpdir(), 'aklapper-pre0011-'));
      const tempMetaDir = resolve(tempPre0011Dir, 'meta');
      mkdirSync(tempMetaDir, { recursive: true });
      const pre0011Entries = fullJournal.entries.filter(entry => entry.idx <= 10);
      for (const entry of pre0011Entries) {
        copyFileSync(
          resolve(drizzleDir, `${entry.tag}.sql`),
          resolve(tempPre0011Dir, `${entry.tag}.sql`),
        );
      }
      writeFileSync(
        resolve(tempMetaDir, '_journal.json'),
        JSON.stringify({ ...fullJournal, entries: pre0011Entries }, null, 2),
        'utf8',
      );

      const isolatedDbName = `migration_0011_verify_${Date.now()}`;
      const noCreateRoleUser = `mig_0011_nocr_${Date.now()}`;
      let isoOwnerPool: Pool | null = null;
      let isoPortalPool: Pool | null = null;

      await ownerPool.query(`CREATE DATABASE "${isolatedDbName}"`);

      try {
        isoOwnerPool = createDbPool(withDatabaseName(ownerDatabaseUrl!, isolatedDbName));
        isoPortalPool = createDbPool(withDatabaseName(portalDatabaseUrl!, isolatedDbName));
        for (const candidatePool of [isoOwnerPool, isoPortalPool]) {
          candidatePool.on('error', (err: unknown) => {
            const code =
              typeof err === 'object' && err !== null && 'code' in err ? err.code : undefined;
            if (code !== '57P01') {
              throw err;
            }
          });
        }

        const isoDb = createDb(isoOwnerPool);

        const readRlsState = async () => {
          const tableRes = await isoOwnerPool!.query<{
            relrowsecurity: boolean;
            relforcerowsecurity: boolean;
          }>(
            `SELECT relrowsecurity, relforcerowsecurity
             FROM pg_class
             WHERE oid = '"public"."rate_limit_buckets"'::regclass`,
          );
          const policyRes = await isoOwnerPool!.query<{ policyname: string }>(
            `SELECT policyname
             FROM pg_policies
             WHERE schemaname = 'public' AND tablename = 'rate_limit_buckets'
             ORDER BY policyname`,
          );
          return {
            rlsEnabled: tableRes.rows[0]?.relrowsecurity ?? false,
            rlsForced: tableRes.rows[0]?.relforcerowsecurity ?? false,
            policies: policyRes.rows.map(row => row.policyname),
          };
        };

        // 1. Pre-0011 baseline (0000..0010): no RLS, no portal_app grants.
        await runMigrations(isoDb, tempPre0011Dir);
        expect(await readRlsState()).toEqual({
          rlsEnabled: false,
          rlsForced: false,
          policies: [],
        });
        await expectSqlState(isoPortalPool.query('SELECT key FROM site_content LIMIT 1'), '42501');

        // 2. Apply 0011 via Drizzle migrator + verify idempotent SQL re-execution.
        await runMigrations(isoDb);
        await isoOwnerPool.query(up0011);
        expect(await readRlsState()).toEqual({
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
        expect(await readRlsState()).toEqual({
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
        expect(await readRlsState()).toEqual({
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
        const guardClient = await isoOwnerPool.connect();
        try {
          await guardClient.query('BEGIN');
          await guardClient.query('DROP SCHEMA drizzle CASCADE');
          await guardClient.query(up0011);
          await guardClient.query(down0011);
          await guardClient.query(up0011);
          await guardClient.query('ROLLBACK');
        } finally {
          guardClient.release();
        }

        // 6. Verify 0011 precondition block: superuser auto-creates NOLOGIN role; non-CREATEROLE fails loud.
        const preconditionBlock = up0011.split('--> statement-breakpoint')[0] ?? '';
        const absentRole = `portal_app_absent_${Date.now()}`;
        const absentRoleSql = preconditionBlock.replaceAll('portal_app', absentRole);

        const superClient = await isoOwnerPool.connect();
        try {
          await superClient.query('BEGIN');
          await superClient.query(absentRoleSql);
          const createdFlags = await superClient.query<{
            rolcanlogin: boolean;
            rolsuper: boolean;
            rolcreatedb: boolean;
            rolcreaterole: boolean;
            rolreplication: boolean;
            rolbypassrls: boolean;
          }>(
            `SELECT rolcanlogin, rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls
             FROM pg_roles
             WHERE rolname = $1`,
            [absentRole],
          );
          expect(createdFlags.rows).toEqual([
            {
              rolcanlogin: false,
              rolsuper: false,
              rolcreatedb: false,
              rolcreaterole: false,
              rolreplication: false,
              rolbypassrls: false,
            },
          ]);
          await superClient.query('ROLLBACK');
        } finally {
          superClient.release();
        }

        await isoOwnerPool.query(
          `CREATE ROLE "${noCreateRoleUser}" NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION`,
        );
        const restrictedClient = await isoOwnerPool.connect();
        try {
          await restrictedClient.query('BEGIN');
          await restrictedClient.query(`SET LOCAL ROLE "${noCreateRoleUser}"`);
          await expect(restrictedClient.query(absentRoleSql)).rejects.toThrow(
            /lacks CREATEROLE\/SUPERUSER.*out-of-band/i,
          );
          await restrictedClient.query('ROLLBACK');
        } finally {
          restrictedClient.release();
          await isoOwnerPool.query(`DROP ROLE IF EXISTS "${noCreateRoleUser}"`);
        }
      } finally {
        if (isoPortalPool) {
          await isoPortalPool.end();
        }
        if (isoOwnerPool) {
          await isoOwnerPool.end();
        }
        await ownerPool.query(`DROP DATABASE IF EXISTS "${isolatedDbName}" WITH (FORCE)`);
        rmSync(tempPre0011Dir, { recursive: true, force: true });
      }
    });
  },
);
