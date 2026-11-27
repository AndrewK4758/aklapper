import { randomUUID } from 'node:crypto';

import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createDbPool } from '../src/index.ts';
import { expectSqlState } from './pg-privilege-helpers.ts';

const ownerDatabaseUrl = process.env['TEST_DATABASE_URL'] ?? process.env['DATABASE_URL'];
const portalDatabaseUrl = process.env['PORTAL_DATABASE_URL'];

describe.skipIf(!ownerDatabaseUrl || !portalDatabaseUrl)(
  'PostgreSQL 19 least-privilege portal_app role, 24-table privilege matrix, and rate_limit_buckets RLS',
  () => {
    let ownerPool: Pool;
    let portalPool: Pool;

    beforeAll(() => {
      ownerPool = createDbPool(ownerDatabaseUrl);
      portalPool = createDbPool(portalDatabaseUrl);
    });

    afterAll(async () => {
      await portalPool.end();
      await ownerPool.end();
    });

    it('enforces exact 24-table portal_app privilege matrix, analytics_events_id_seq, INSERT-only contact_submissions without RETURNING, and DDL denial', async () => {
      const whoami = await portalPool.query<{ current_user: string }>('SELECT current_user');
      expect(whoami.rows[0]?.current_user).toBe('portal_app');

      const suffix = `${Date.now()}`;
      const testSkillSlug = `portal-priv-skill-${suffix}`;
      const testCreatorHandle = `portal_priv_creator_${suffix}`;
      const testSessionId = `sess_portal_priv_${suffix}`;
      const testContactId = randomUUID();

      try {
        // 1. Read-only Portal tables allow SELECT and reject INSERT/UPDATE/DELETE with 42501.
        const readOnlyTables: ReadonlyArray<{ table: string; column: string }> = [
          { table: 'site_content', column: 'key' },
          { table: 'terminal_profiles', column: 'slug' },
          { table: 'terminal_initial_entries', column: 'id' },
          { table: 'terminal_commands', column: 'id' },
          { table: 'terminal_directory_entries', column: 'id' },
          { table: 'career_dossiers', column: 'slug' },
          { table: 'cadence_presets', column: 'slug' },
          { table: 'quota_policies', column: 'role' },
        ];
        for (const { table, column } of readOnlyTables) {
          await expect(
            portalPool.query(`SELECT "${column}" FROM "public"."${table}" LIMIT 1`),
          ).resolves.toBeDefined();
          await expectSqlState(
            portalPool.query(`INSERT INTO "public"."${table}" DEFAULT VALUES`),
            '42501',
          );
          await expectSqlState(
            portalPool.query(
              `UPDATE "public"."${table}" SET "${column}" = "${column}" WHERE false`,
            ),
            '42501',
          );
          await expectSqlState(
            portalPool.query(`DELETE FROM "public"."${table}" WHERE false`),
            '42501',
          );
        }

        // 2. Scoped write tables allow SELECT/INSERT/UPDATE and deny DELETE with 42501.
        await portalPool.query(
          `INSERT INTO agensi_skills (slug, name, summary, tags, url, sort_order, creator_handle, is_published, source)
           VALUES ($1, 'Privilege Test Skill', 'Summary text', '{}'::text[], 'https://agensi.io/s/priv', 99, $2, true, 'live')`,
          [testSkillSlug, testCreatorHandle],
        );
        await portalPool.query(`UPDATE agensi_skills SET is_published = false WHERE slug = $1`, [
          testSkillSlug,
        ]);
        await expectSqlState(
          portalPool.query(`DELETE FROM agensi_skills WHERE slug = $1`, [testSkillSlug]),
          '42501',
        );

        await portalPool.query(
          `INSERT INTO agensi_sync_state (creator_handle, last_status, item_count)
           VALUES ($1, 'ok', 1)`,
          [testCreatorHandle],
        );
        await portalPool.query(
          `UPDATE agensi_sync_state SET item_count = 2 WHERE creator_handle = $1`,
          [testCreatorHandle],
        );
        await expectSqlState(
          portalPool.query(`DELETE FROM agensi_sync_state WHERE creator_handle = $1`, [
            testCreatorHandle,
          ]),
          '42501',
        );

        await portalPool.query(
          `INSERT INTO analytics_sessions (session_id, ip_hash, app, is_bot)
           VALUES ($1, 'abcdef0123456789abcdef01', 'portal', false)`,
          [testSessionId],
        );
        await portalPool.query(
          `UPDATE analytics_sessions SET last_seen_at = NOW() WHERE session_id = $1`,
          [testSessionId],
        );
        await expectSqlState(
          portalPool.query(`DELETE FROM analytics_sessions WHERE session_id = $1`, [testSessionId]),
          '42501',
        );

        // 3. analytics_events allows SELECT + INSERT consuming analytics_events_id_seq; denies UPDATE/DELETE.
        await portalPool.query(
          `INSERT INTO analytics_events (session_id, type, name, path, metadata_json)
           VALUES ($1, 'page_view', 'portal_page_view', '/about', '{}'::jsonb)`,
          [testSessionId],
        );
        const eventSelect = await portalPool.query<{ id: number }>(
          `SELECT id FROM analytics_events WHERE session_id = $1`,
          [testSessionId],
        );
        expect(eventSelect.rows).toHaveLength(1);
        await expectSqlState(
          portalPool.query(`UPDATE analytics_events SET path = '/' WHERE session_id = $1`, [
            testSessionId,
          ]),
          '42501',
        );
        await expectSqlState(
          portalPool.query(`DELETE FROM analytics_events WHERE session_id = $1`, [testSessionId]),
          '42501',
        );

        // 4. contact_submissions allows plain INSERT without RETURNING; denies SELECT/UPDATE/DELETE/INSERT...RETURNING.
        await portalPool.query(
          `INSERT INTO contact_submissions (id, name, phone, email, message, analytics_session_id, created_at)
           VALUES ($1::uuid, 'Ada Lovelace', NULL, 'ada@example.com', 'Least privilege insert without returning clause.', $2, NOW())`,
          [testContactId, testSessionId],
        );
        const persistedContact = await ownerPool.query<{
          id: string;
          analytics_session_id: string;
        }>(`SELECT id, analytics_session_id FROM contact_submissions WHERE id = $1::uuid`, [
          testContactId,
        ]);
        expect(persistedContact.rows).toEqual([
          { id: testContactId, analytics_session_id: testSessionId },
        ]);

        await expectSqlState(
          portalPool.query(`SELECT id FROM contact_submissions LIMIT 1`),
          '42501',
        );
        await expectSqlState(
          portalPool.query(`UPDATE contact_submissions SET name = 'Mutated' WHERE id = $1::uuid`, [
            testContactId,
          ]),
          '42501',
        );
        await expectSqlState(
          portalPool.query(`DELETE FROM contact_submissions WHERE id = $1::uuid`, [testContactId]),
          '42501',
        );
        await expectSqlState(
          portalPool.query(
            `INSERT INTO contact_submissions (id, name, phone, email, message, created_at)
             VALUES ($1::uuid, 'Ada Lovelace', NULL, 'ada@example.com', 'Insert with returning must fail 42501.', NOW())
             RETURNING id`,
            [randomUUID()],
          ),
          '42501',
        );

        // 5. All 10 restricted application tables + drizzle.__drizzle_migrations deny SELECT/INSERT/UPDATE/DELETE with 42501.
        const deniedTables: ReadonlyArray<{ schema: string; table: string; column: string }> = [
          { schema: 'public', table: 'users', column: 'id' },
          { schema: 'public', table: 'webauthn_credentials', column: 'credential_id' },
          { schema: 'public', table: 'totp_secrets', column: 'user_id' },
          { schema: 'public', table: 'auth_sessions', column: 'id' },
          { schema: 'public', table: 'webauthn_challenges', column: 'id' },
          { schema: 'public', table: 'sandbox_runs', column: 'id' },
          { schema: 'public', table: 'sandbox_turns', column: 'id' },
          { schema: 'public', table: 'ask_turns', column: 'attempt_id' },
          { schema: 'public', table: 'menu_items', column: 'slug' },
          { schema: 'public', table: 'roadmap_milestones', column: 'slug' },
          { schema: 'drizzle', table: '__drizzle_migrations', column: 'id' },
        ];
        for (const { schema, table, column } of deniedTables) {
          const qualified = `"${schema}"."${table}"`;
          await expectSqlState(
            portalPool.query(`SELECT "${column}" FROM ${qualified} LIMIT 1`),
            '42501',
          );
          await expectSqlState(
            portalPool.query(`INSERT INTO ${qualified} DEFAULT VALUES`),
            '42501',
          );
          await expectSqlState(
            portalPool.query(`UPDATE ${qualified} SET "${column}" = "${column}" WHERE false`),
            '42501',
          );
          await expectSqlState(portalPool.query(`DELETE FROM ${qualified} WHERE false`), '42501');
        }

        // 6. DDL statements in schema public fail deterministically with 42501.
        await expectSqlState(
          portalPool.query(`CREATE TABLE "public"."portal_ddl_probe_${suffix}" (id int)`),
          '42501',
        );
        await expectSqlState(
          portalPool.query(`ALTER TABLE "public"."site_content" ADD COLUMN portal_probe text`),
          '42501',
        );
        await expectSqlState(portalPool.query(`DROP TABLE "public"."site_content"`), '42501');
      } finally {
        await ownerPool.query(`DELETE FROM contact_submissions WHERE id = $1::uuid`, [
          testContactId,
        ]);
        await ownerPool.query(`DELETE FROM analytics_events WHERE session_id = $1`, [
          testSessionId,
        ]);
        await ownerPool.query(`DELETE FROM analytics_sessions WHERE session_id = $1`, [
          testSessionId,
        ]);
        await ownerPool.query(`DELETE FROM agensi_skills WHERE slug = $1`, [testSkillSlug]);
        await ownerPool.query(`DELETE FROM agensi_sync_state WHERE creator_handle = $1`, [
          testCreatorHandle,
        ]);
      }
    });

    it('isolates rate_limit_buckets via non-FORCE RLS for portal_app while preserving owner access', async () => {
      const tag = `rls_probe_${Date.now()}`;
      const authKey = `auth:login:admin_${tag}`;
      const globalKey = `global:2026-11-27_${tag}`;
      const sessionKey = `session:guest_${tag}`;
      const contactKey = `contact:ip:${tag}`;
      const analyticsKey = `analytics:ip:${tag}`;
      const contactFreshKey = `contact:ip:fresh_${tag}`;
      const analyticsFreshKey = `analytics:ip:fresh_${tag}`;
      const allKeys = [
        authKey,
        globalKey,
        sessionKey,
        contactKey,
        analyticsKey,
        contactFreshKey,
        analyticsFreshKey,
      ];

      try {
        await ownerPool.query(
          `INSERT INTO rate_limit_buckets (scope_key, window_start, turns_used, tokens_used)
           VALUES
             ($1, NOW(), 3, 0),
             ($2, NOW(), 0, 500),
             ($3, NOW(), 2, 120),
             ($4, NOW(), 1, 0),
             ($5, NOW(), 4, 0)`,
          [authKey, globalKey, sessionKey, contactKey, analyticsKey],
        );

        // portal_app SELECT sees strictly session:*, contact:ip:*, analytics:ip:* (auth:* & global:* invisible).
        const visible = await portalPool.query<{ scope_key: string }>(
          `SELECT scope_key
           FROM rate_limit_buckets
           WHERE scope_key LIKE $1
           ORDER BY scope_key`,
          [`%${tag}`],
        );
        expect(visible.rows.map(row => row.scope_key)).toEqual(
          [analyticsKey, contactKey, sessionKey].toSorted(),
        );

        // portal_app INSERT & ON CONFLICT upsert on auth:*, global:*, and session:* fail with 42501.
        for (const forbiddenKey of [
          `auth:login:new_${tag}`,
          `global:2026-11-28_${tag}`,
          `session:new_${tag}`,
        ]) {
          await expectSqlState(
            portalPool.query(
              `INSERT INTO rate_limit_buckets (scope_key, window_start, turns_used, tokens_used)
               VALUES ($1, NOW(), 1, 0)`,
              [forbiddenKey],
            ),
            '42501',
          );
        }

        for (const existingForbiddenKey of [authKey, globalKey, sessionKey]) {
          await expectSqlState(
            portalPool.query(
              `INSERT INTO rate_limit_buckets (scope_key, window_start, turns_used, tokens_used)
               VALUES ($1, NOW(), 1, 0)
               ON CONFLICT (scope_key) DO UPDATE SET turns_used = rate_limit_buckets.turns_used + 1`,
              [existingForbiddenKey],
            ),
            '42501',
          );
          const updateRes = await portalPool.query(
            `UPDATE rate_limit_buckets SET turns_used = 999 WHERE scope_key = $1`,
            [existingForbiddenKey],
          );
          expect(updateRes.rowCount).toBe(0);
        }

        // portal_app cannot re-key a portal row into a forbidden prefix or DELETE any row.
        await expectSqlState(
          portalPool.query(`UPDATE rate_limit_buckets SET scope_key = $1 WHERE scope_key = $2`, [
            `auth:login:hijack_${tag}`,
            contactKey,
          ]),
          '42501',
        );
        await expectSqlState(
          portalPool.query(`DELETE FROM rate_limit_buckets WHERE scope_key = $1`, [contactKey]),
          '42501',
        );

        // portal_app atomic INSERT ... ON CONFLICT DO UPDATE ... RETURNING succeeds for contact:ip:* and analytics:ip:*.
        for (const key of [contactKey, analyticsKey, contactFreshKey, analyticsFreshKey]) {
          const upsert = await portalPool.query<{ scope_key: string; turns_used: number }>(
            `INSERT INTO rate_limit_buckets (scope_key, window_start, turns_used, tokens_used)
             VALUES ($1, NOW(), 1, 0)
             ON CONFLICT (scope_key)
             DO UPDATE SET turns_used = rate_limit_buckets.turns_used + 1
             RETURNING scope_key, turns_used`,
            [key],
          );
          expect(upsert.rows[0]?.scope_key).toBe(key);
        }

        // Verify auth:*, global:*, and session:* remained untouched and owner bypasses non-FORCE RLS seamlessly.
        const ownerCheck = await ownerPool.query<{
          scope_key: string;
          turns_used: number;
          tokens_used: number;
        }>(
          `SELECT scope_key, turns_used, tokens_used
           FROM rate_limit_buckets
           WHERE scope_key = ANY($1::text[])
           ORDER BY scope_key`,
          [[authKey, globalKey, sessionKey]],
        );
        expect(ownerCheck.rows).toEqual([
          { scope_key: authKey, turns_used: 3, tokens_used: 0 },
          { scope_key: globalKey, turns_used: 0, tokens_used: 500 },
          { scope_key: sessionKey, turns_used: 2, tokens_used: 120 },
        ]);

        const ownerUpdate = await ownerPool.query<{ turns_used: number }>(
          `UPDATE rate_limit_buckets SET turns_used = turns_used + 1 WHERE scope_key = $1 RETURNING turns_used`,
          [authKey],
        );
        expect(ownerUpdate.rows[0]?.turns_used).toBe(4);
      } finally {
        await ownerPool.query(`DELETE FROM rate_limit_buckets WHERE scope_key = ANY($1::text[])`, [
          allKeys,
        ]);
      }
    });
  },
);
