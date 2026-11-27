import { randomUUID } from 'node:crypto';

import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createDbPool } from '../src/index.ts';
import {
  assertPublicDdlDenied,
  assertTablesFullyDenied,
  assertTablesReadOnly,
  expectSqlState,
  readRoleCatalogFlags,
} from './pg-privilege-helpers.ts';

const ownerDatabaseUrl = process.env['TEST_DATABASE_URL'] ?? process.env['DATABASE_URL'];
const portalDatabaseUrl = process.env['PORTAL_DATABASE_URL'];
const adminDatabaseUrl = process.env['ADMIN_DATABASE_URL'];

type SqlTuple = readonly [sql: string, params: readonly unknown[]];

describe.skipIf(!ownerDatabaseUrl || !portalDatabaseUrl || !adminDatabaseUrl)(
  'PostgreSQL 19 least-privilege admin_app role, 23-table privilege matrix, and concurrent rate_limit_buckets RLS',
  () => {
    let ownerPool: Pool;
    let adminPool: Pool;
    let portalPool: Pool;

    beforeAll(() => {
      ownerPool = createDbPool(ownerDatabaseUrl);
      adminPool = createDbPool(adminDatabaseUrl);
      portalPool = createDbPool(portalDatabaseUrl);
    });

    afterAll(async () => {
      await portalPool.end();
      await adminPool.end();
      await ownerPool.end();
    });

    it('enforces exact 23-table admin_app privilege matrix, 4 sequences, dossier search_tsv trigger, WebAuthn flags, and DDL/roadmap/drizzle denial', async () => {
      expect(
        (await adminPool.query<{ current_user: string }>('SELECT current_user')).rows[0]
          ?.current_user,
      ).toBe('admin_app');
      expect(await readRoleCatalogFlags(ownerPool, 'admin_app')).toEqual([
        {
          rolcanlogin: true,
          rolsuper: false,
          rolcreatedb: false,
          rolcreaterole: false,
          rolinherit: false,
          rolreplication: false,
          rolbypassrls: false,
        },
      ]);

      const suffix = `${Date.now()}`;
      const userId = randomUUID();
      const credId = `cred_admin_priv_${suffix}`;
      const sessUuid = randomUUID();
      const challengeUuid = randomUUID();
      const quotaRole = `admin_priv_role_${suffix}`;
      const siteKey = `admin-priv-content-${suffix}`;
      const profileSlug = `admin-priv-profile-${suffix}`;
      const skillSlug = `admin-priv-skill-${suffix}`;
      const creatorHandle = `admin_priv_creator_${suffix}`;
      const analyticsSessId = `sess_admin_priv_${suffix}`;
      const menuSlug = `admin-priv-menu-${suffix}`;
      const presetSlug = `admin-priv-preset-${suffix}`;
      const dossierSlug = `admin-priv-dossier-${suffix}`;
      const contactId = randomUUID();
      const sandboxRunId = randomUUID();

      await ownerPool.query(`INSERT INTO users (id, handle, role) VALUES ($1::uuid, $2, 'admin')`, [
        userId,
        `admin_priv_user_${suffix}`,
      ]);
      await ownerPool.query(
        `INSERT INTO contact_submissions (id, name, phone, email, message, created_at)
         VALUES ($1::uuid, 'Grace Hopper', NULL, 'grace@example.com', 'Owner-seeded contact row for admin privilege check.', NOW())`,
        [contactId],
      );
      await ownerPool.query(
        `INSERT INTO sandbox_runs (id, session_id, ip_hash, menu_slug, prompt, status, gate_verdict, is_golden, execution_mode)
         VALUES ($1::uuid, $2, 'abcdef0123456789abcdef01', 'cadence', 'Probe prompt', 'ready', 'pending', false, 'fast')`,
        [sandboxRunId, `sandbox_admin_priv_${suffix}`],
      );

      try {
        // 1. SELECT-only tables (3): users, sandbox_turns, ask_turns.
        await assertTablesReadOnly(adminPool, [
          { table: 'users', column: 'id' },
          { table: 'sandbox_turns', column: 'id' },
          { table: 'ask_turns', column: 'attempt_id' },
        ]);

        // 2. SELECT/INSERT/UPDATE tables (9) deny DELETE with 42501, including nullable WebAuthn flags.
        await adminPool.query(
          `INSERT INTO webauthn_credentials (credential_id, user_id, public_key, counter, transports)
           VALUES ($1, $2::uuid, 'cHVibGljX2tleQ', 0, ARRAY['internal'])`,
          [credId, userId],
        );
        expect(
          (
            await adminPool.query<{
              backup_eligible: boolean | null;
              backup_state: boolean | null;
            }>(
              `SELECT backup_eligible, backup_state FROM webauthn_credentials WHERE credential_id = $1`,
              [credId],
            )
          ).rows,
        ).toEqual([{ backup_eligible: null, backup_state: null }]);
        await adminPool.query(
          `UPDATE webauthn_credentials SET counter = 1, backup_eligible = true, backup_state = true WHERE credential_id = $1`,
          [credId],
        );
        expect(
          (
            await adminPool.query<{
              counter: number;
              backup_eligible: boolean | null;
              backup_state: boolean | null;
            }>(
              `SELECT counter, backup_eligible, backup_state FROM webauthn_credentials WHERE credential_id = $1`,
              [credId],
            )
          ).rows,
        ).toEqual([{ counter: 1, backup_eligible: true, backup_state: true }]);
        await expectSqlState(
          adminPool.query(`DELETE FROM webauthn_credentials WHERE credential_id = $1`, [credId]),
          '42501',
        );

        const noDeleteCases: ReadonlyArray<readonly [SqlTuple, SqlTuple, SqlTuple]> = [
          [
            [
              `INSERT INTO auth_sessions (id, user_id, role, expires_at) VALUES ($1::uuid, $2::uuid, 'admin', NOW() + INTERVAL '12 hours')`,
              [sessUuid, userId],
            ],
            [`UPDATE auth_sessions SET revoked_at = NOW() WHERE id = $1::uuid`, [sessUuid]],
            [`DELETE FROM auth_sessions WHERE id = $1::uuid`, [sessUuid]],
          ],
          [
            [
              `INSERT INTO webauthn_challenges (id, challenge, user_id, kind, expires_at) VALUES ($1::uuid, 'challenge-token', $2::uuid, 'login', NOW() + INTERVAL '5 minutes')`,
              [challengeUuid, userId],
            ],
            [
              `UPDATE webauthn_challenges SET consumed_at = NOW() WHERE id = $1::uuid`,
              [challengeUuid],
            ],
            [`DELETE FROM webauthn_challenges WHERE id = $1::uuid`, [challengeUuid]],
          ],
          [
            [
              `INSERT INTO quota_policies (role, max_turns_per_session, max_tokens_per_run, max_daily_global_tokens) VALUES ($1, 10, 2000, 20000)`,
              [quotaRole],
            ],
            [`UPDATE quota_policies SET max_turns_per_session = 12 WHERE role = $1`, [quotaRole]],
            [`DELETE FROM quota_policies WHERE role = $1`, [quotaRole]],
          ],
          [
            [
              `INSERT INTO site_content (key, markdown_body, metadata_json) VALUES ($1, 'body', '{}'::jsonb)`,
              [siteKey],
            ],
            [`UPDATE site_content SET markdown_body = 'updated' WHERE key = $1`, [siteKey]],
            [`DELETE FROM site_content WHERE key = $1`, [siteKey]],
          ],
          [
            [
              `INSERT INTO terminal_profiles (slug, banner_title, banner_meta, directory, vcs_branch, context_label, placeholder) VALUES ($1, 'Admin Probe', 'meta', '~/probe', 'main', 'ops', 'type command')`,
              [profileSlug],
            ],
            [`UPDATE terminal_profiles SET banner_meta = 'updated' WHERE slug = $1`, [profileSlug]],
            [`DELETE FROM terminal_profiles WHERE slug = $1`, [profileSlug]],
          ],
          [
            [
              `INSERT INTO agensi_skills (slug, name, summary, tags, url, sort_order, creator_handle, is_published, source) VALUES ($1, 'Admin Probe Skill', 'Summary', '{}'::text[], 'https://agensi.io/s/admin-priv', 1, $2, true, 'live')`,
              [skillSlug, creatorHandle],
            ],
            [`UPDATE agensi_skills SET is_published = false WHERE slug = $1`, [skillSlug]],
            [`DELETE FROM agensi_skills WHERE slug = $1`, [skillSlug]],
          ],
          [
            [
              `INSERT INTO agensi_sync_state (creator_handle, last_status, item_count) VALUES ($1, 'ok', 1)`,
              [creatorHandle],
            ],
            [
              `UPDATE agensi_sync_state SET item_count = 3 WHERE creator_handle = $1`,
              [creatorHandle],
            ],
            [`DELETE FROM agensi_sync_state WHERE creator_handle = $1`, [creatorHandle]],
          ],
          [
            [
              `INSERT INTO analytics_sessions (session_id, ip_hash, app, is_bot) VALUES ($1, 'abcdef0123456789abcdef01', 'admin', false)`,
              [analyticsSessId],
            ],
            [
              `UPDATE analytics_sessions SET last_seen_at = NOW() WHERE session_id = $1`,
              [analyticsSessId],
            ],
            [`DELETE FROM analytics_sessions WHERE session_id = $1`, [analyticsSessId]],
          ],
        ];
        for (const [ins, upd, del] of noDeleteCases) {
          await adminPool.query(ins[0], [...ins[1]]);
          await adminPool.query(upd[0], [...upd[1]]);
          await expectSqlState(adminPool.query(del[0], [...del[1]]), '42501');
        }

        // 3. Full CRUD tables (8) + 3 terminal sequences + career_dossiers_refresh_search_tsv() trigger.
        await adminPool.query(
          `INSERT INTO totp_secrets (user_id, encrypted_secret, enabled, backup_codes_hash)
           VALUES ($1::uuid, 'v1.iv.tag.ct', true, ARRAY['hash-a', 'hash-b'])`,
          [userId],
        );
        expect(
          (
            await adminPool.query<{ user_id: string }>(
              `UPDATE totp_secrets SET backup_codes_hash = array_remove(backup_codes_hash, $2::text)
               WHERE user_id = $1::uuid AND $2::text = ANY(backup_codes_hash) RETURNING user_id`,
              [userId, 'hash-a'],
            )
          ).rows,
        ).toEqual([{ user_id: userId }]);
        await adminPool.query(`DELETE FROM totp_secrets WHERE user_id = $1::uuid`, [userId]);

        for (const [ins, upd, del] of [
          [
            [
              `INSERT INTO menu_items (slug, key_shortcut, title, description, admin_only, sort_order, enabled) VALUES ($1, 'z', 'Probe', 'Probe menu', true, 99, true)`,
              [menuSlug],
            ],
            [`UPDATE menu_items SET title = 'Probe Updated' WHERE slug = $1`, [menuSlug]],
            [`DELETE FROM menu_items WHERE slug = $1`, [menuSlug]],
          ],
          [
            [
              `INSERT INTO cadence_presets (slug, title, starter_prompt, expected_kind, starter_artifact_html, sort_order) VALUES ($1, 'Preset', 'Prompt', 'diagram', '<p>ok</p>', 99)`,
              [presetSlug],
            ],
            [`UPDATE cadence_presets SET title = 'Preset 2' WHERE slug = $1`, [presetSlug]],
            [`DELETE FROM cadence_presets WHERE slug = $1`, [presetSlug]],
          ],
        ] as ReadonlyArray<readonly [SqlTuple, SqlTuple, SqlTuple]>) {
          await adminPool.query(ins[0], [...ins[1]]);
          await adminPool.query(upd[0], [...upd[1]]);
          await adminPool.query(del[0], [...del[1]]);
        }

        for (const [table, insertSql, updateCol, updateVal] of [
          [
            'terminal_commands',
            `INSERT INTO terminal_commands (profile_slug, name, description, kind, output, sort_order) VALUES ($1, 'probe', 'Probe cmd', 'static', 'ok', 1) RETURNING id`,
            'output',
            'ok2',
          ],
          [
            'terminal_initial_entries',
            `INSERT INTO terminal_initial_entries (profile_slug, command, output, status, duration_label, timestamp_label, sort_order) VALUES ($1, 'whoami', 'admin', 'ok', '1ms', '00:00:00', 1) RETURNING id`,
            'output',
            'ops',
          ],
          [
            'terminal_directory_entries',
            `INSERT INTO terminal_directory_entries (profile_slug, name, description, sort_order, enabled) VALUES ($1, 'probe-dir', 'Probe directory', 1, true) RETURNING id`,
            'enabled',
            false,
          ],
        ] as ReadonlyArray<readonly [string, string, string, unknown]>) {
          const rowId = (await adminPool.query<{ id: number }>(insertSql, [profileSlug])).rows[0]!
            .id;
          expect(rowId).toBeGreaterThan(0);
          await adminPool.query(
            `UPDATE "public"."${table}" SET "${updateCol}" = $1 WHERE id = $2`,
            [updateVal, rowId],
          );
          await adminPool.query(`DELETE FROM "public"."${table}" WHERE id = $1`, [rowId]);
        }

        const dossierInsert = await adminPool.query<{ tsv: string }>(
          `INSERT INTO career_dossiers (slug, kind, title, domain_label, role_title, timeframe, skills, summary_body, sections_json, publish_status, sort_order)
           VALUES ($1, 'project', 'Least Privilege Trigger Probe', 'Security', 'Architect', '2026', ARRAY['PostgreSQL'], 'Verifies trigger execution under admin_app.', '[]'::jsonb, 'draft', 99)
           RETURNING search_tsv::text AS tsv`,
          [dossierSlug],
        );
        expect(dossierInsert.rows[0]?.tsv).toContain('privileg');
        await adminPool.query(
          `UPDATE career_dossiers SET title = 'Updated Trigger Probe' WHERE slug = $1`,
          [dossierSlug],
        );
        await adminPool.query(`DELETE FROM career_dossiers WHERE slug = $1`, [dossierSlug]);

        // 4. contact_submissions: SELECT + DELETE; deny INSERT + UPDATE.
        expect(
          (
            await adminPool.query<{ id: string }>(
              `SELECT id FROM contact_submissions WHERE id = $1::uuid`,
              [contactId],
            )
          ).rows,
        ).toEqual([{ id: contactId }]);
        await expectSqlState(
          adminPool.query(
            `INSERT INTO contact_submissions (name, email, message) VALUES ('Ada Lovelace', 'ada@example.com', 'Admin must not insert contact submissions.')`,
          ),
          '42501',
        );
        await expectSqlState(
          adminPool.query(`UPDATE contact_submissions SET name = 'Mutated' WHERE id = $1::uuid`, [
            contactId,
          ]),
          '42501',
        );
        await adminPool.query(`DELETE FROM contact_submissions WHERE id = $1::uuid`, [contactId]);

        // 5. sandbox_runs: SELECT + UPDATE; deny INSERT + DELETE.
        expect(
          (
            await adminPool.query<{ id: string }>(
              `SELECT id FROM sandbox_runs WHERE id = $1::uuid`,
              [sandboxRunId],
            )
          ).rows,
        ).toEqual([{ id: sandboxRunId }]);
        await adminPool.query(
          `UPDATE sandbox_runs SET gate_verdict = 'approved' WHERE id = $1::uuid`,
          [sandboxRunId],
        );
        await expectSqlState(adminPool.query(`INSERT INTO sandbox_runs DEFAULT VALUES`), '42501');
        await expectSqlState(
          adminPool.query(`DELETE FROM sandbox_runs WHERE id = $1::uuid`, [sandboxRunId]),
          '42501',
        );

        // 6. analytics_events: SELECT + INSERT (analytics_events_id_seq); deny UPDATE + DELETE.
        const eventId = (
          await adminPool.query<{ id: number }>(
            `INSERT INTO analytics_events (session_id, type, name, path, metadata_json) VALUES ($1, 'client_error', 'admin_error', '/cms', '{}'::jsonb) RETURNING id`,
            [analyticsSessId],
          )
        ).rows[0]?.id;
        expect(eventId).toBeGreaterThan(0);
        await expect(
          adminPool.query(`SELECT id FROM analytics_events WHERE session_id = $1`, [
            analyticsSessId,
          ]),
        ).resolves.toBeDefined();
        await expectSqlState(
          adminPool.query(`UPDATE analytics_events SET path = '/ops' WHERE session_id = $1`, [
            analyticsSessId,
          ]),
          '42501',
        );
        await expectSqlState(
          adminPool.query(`DELETE FROM analytics_events WHERE session_id = $1`, [analyticsSessId]),
          '42501',
        );

        // 7. Excluded roadmap_milestones, drizzle.__drizzle_migrations, and public DDL fail with 42501.
        await assertTablesFullyDenied(adminPool, [
          { schema: 'public', table: 'roadmap_milestones', column: 'slug' },
          { schema: 'drizzle', table: '__drizzle_migrations', column: 'id' },
        ]);
        await assertPublicDdlDenied(adminPool, `admin_ddl_probe_${suffix}`, 'users', 'menu_items');
      } finally {
        const cleanups: readonly SqlTuple[] = [
          [`DELETE FROM sandbox_runs WHERE id = $1::uuid`, [sandboxRunId]],
          [`DELETE FROM contact_submissions WHERE id = $1::uuid`, [contactId]],
          [`DELETE FROM analytics_events WHERE session_id = $1`, [analyticsSessId]],
          [`DELETE FROM analytics_sessions WHERE session_id = $1`, [analyticsSessId]],
          [`DELETE FROM agensi_skills WHERE slug = $1`, [skillSlug]],
          [`DELETE FROM agensi_sync_state WHERE creator_handle = $1`, [creatorHandle]],
          [`DELETE FROM terminal_profiles WHERE slug = $1`, [profileSlug]],
          [`DELETE FROM site_content WHERE key = $1`, [siteKey]],
          [`DELETE FROM quota_policies WHERE role = $1`, [quotaRole]],
          [`DELETE FROM users WHERE id = $1::uuid`, [userId]],
        ];
        for (const [sql, params] of cleanups) {
          await ownerPool.query(sql, [...params]);
        }
      }
    });

    it('grants admin_app full CRUD on rate_limit_buckets across all prefixes while keeping portal_app strictly RLS-confined', async () => {
      const tag = `admin_rls_${Date.now()}`;
      const authLoginKey = `auth:login:ip:${tag}`;
      const globalKey = `global:2026-11-27_${tag}`;
      const adminKey = `admin:analytics:user:${tag}`;
      const contactKey = `contact:ip:${tag}`;
      const analyticsKey = `analytics:ip:${tag}`;
      const allKeys = [authLoginKey, globalKey, adminKey, contactKey, analyticsKey];

      try {
        for (const key of allKeys) {
          const upserted = await adminPool.query<{ scope_key: string; turns_used: number }>(
            `INSERT INTO rate_limit_buckets (scope_key, window_start, turns_used, tokens_used)
             VALUES ($1, NOW(), 1, 0)
             ON CONFLICT (scope_key) DO UPDATE SET turns_used = rate_limit_buckets.turns_used + 1
             RETURNING scope_key, turns_used`,
            [key],
          );
          expect(upserted.rows).toEqual([{ scope_key: key, turns_used: 1 }]);
        }

        const adminVisible = await adminPool.query<{ scope_key: string }>(
          `SELECT scope_key FROM rate_limit_buckets WHERE scope_key LIKE $1 ORDER BY scope_key`,
          [`%${tag}`],
        );
        expect(adminVisible.rows.map(row => row.scope_key)).toEqual(allKeys.toSorted());

        expect(
          (
            await adminPool.query<{ turns_used: number }>(
              `UPDATE rate_limit_buckets SET turns_used = 7 WHERE scope_key = $1 RETURNING turns_used`,
              [authLoginKey],
            )
          ).rows,
        ).toEqual([{ turns_used: 7 }]);

        const portalVisible = await portalPool.query<{ scope_key: string }>(
          `SELECT scope_key FROM rate_limit_buckets WHERE scope_key LIKE $1 ORDER BY scope_key`,
          [`%${tag}`],
        );
        expect(portalVisible.rows.map(row => row.scope_key)).toEqual(
          [analyticsKey, contactKey].toSorted(),
        );
        for (const hiddenKey of [authLoginKey, globalKey, adminKey]) {
          await expectSqlState(
            portalPool.query(
              `INSERT INTO rate_limit_buckets (scope_key, window_start, turns_used, tokens_used) VALUES ($1, NOW(), 1, 0)`,
              [`${hiddenKey}_new`],
            ),
            '42501',
          );
          expect(
            (
              await portalPool.query(
                `UPDATE rate_limit_buckets SET turns_used = 999 WHERE scope_key = $1`,
                [hiddenKey],
              )
            ).rowCount,
          ).toBe(0);
        }

        const deleted = await adminPool.query<{ scope_key: string }>(
          `DELETE FROM rate_limit_buckets WHERE scope_key = ANY($1::text[]) RETURNING scope_key`,
          [allKeys],
        );
        expect(deleted.rows.map(row => row.scope_key).toSorted()).toEqual(allKeys.toSorted());
      } finally {
        await ownerPool.query(`DELETE FROM rate_limit_buckets WHERE scope_key = ANY($1::text[])`, [
          allKeys,
        ]);
      }
    });
  },
);
