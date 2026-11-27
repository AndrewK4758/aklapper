import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import { SITE_CONTENT_KEYS } from '@aklapper/core';
import { verifyPasswordArgon2id } from '@aklapper/node-runtime/auth';
import { PrivacySanitizationError } from '@aklapper/node-runtime/go-privacy-check';
import { eq, sql } from 'drizzle-orm';
import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  type AppDatabase,
  askTurns,
  CADENCE_PRESET_SEEDS,
  CAREER_DOSSIER_SEEDS,
  careerDossiers,
  createDb,
  createDbPool,
  findAdminUserForPasswordLogin,
  PORTAL_ABOUT_SEED,
  roadmapMilestones,
  seedAdminUserFromEnv,
  seedDatabase,
  users,
} from '../src/index.ts';
import { runMigrationCli, runMigrations } from '../src/migrate.ts';

function extractPgError(error: unknown): { code?: string; constraint?: string } {
  let current: unknown = error;
  for (let i = 0; i < 4 && current && typeof current === 'object'; i += 1) {
    const rec = current as Record<string, unknown>;
    if (typeof rec['code'] === 'string') {
      return {
        code: rec['code'],
        constraint: typeof rec['constraint'] === 'string' ? rec['constraint'] : undefined,
      };
    }
    current = rec['cause'];
  }
  return {};
}

describe('@aklapper/db PostgreSQL 19 offline migration & seed integration', () => {
  let pool: Pool;
  let db: AppDatabase;

  beforeAll(() => {
    pool = createDbPool();
    db = createDb(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  it('preserves admin-added roadmap_milestones rows on default and bootstrap seedDatabase runs and exports ./migrate and ./seed-admin', async () => {
    const pkgJson = JSON.parse(
      readFileSync(resolve(import.meta.dirname, '..', 'package.json'), 'utf8'),
    ) as { exports: Record<string, unknown> };
    expect(pkgJson.exports['./migrate']).toMatchObject({
      import: './dist/migrate.js',
      default: './dist/migrate.js',
    });
    expect(pkgJson.exports['./seed-admin']).toMatchObject({
      import: './dist/seed-admin.js',
      default: './dist/seed-admin.js',
    });
    expect(pkgJson.exports['./auth']).toBeUndefined();
    expect(pkgJson.exports['./analytics']).toBeUndefined();
    expect(pkgJson.exports['./queries']).toBeUndefined();
    expect(pkgJson.exports['./prerender']).toBeUndefined();
    expect(existsSync(resolve(import.meta.dirname, '..', 'dist', 'migrate.js'))).toBe(true);
    expect(existsSync(resolve(import.meta.dirname, '..', 'dist', 'seed-admin.js'))).toBe(true);

    const customSlug = 'custom-cms-milestone-e2e-check';
    await db
      .insert(roadmapMilestones)
      .values({
        slug: customSlug,
        status: 'active',
        label: 'Custom CMS milestone added by admin',
        sortOrder: 99,
        enabled: true,
      })
      .onConflictDoNothing({ target: roadmapMilestones.slug });

    try {
      await seedDatabase(db, { mode: 'bootstrap', env: { ADMIN_PASSWORD: '' } });
      await seedDatabase(db, { env: { ADMIN_PASSWORD: '' } });

      const rows = await db
        .select()
        .from(roadmapMilestones)
        .where(eq(roadmapMilestones.slug, customSlug));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.label).toBe('Custom CMS milestone added by admin');
    } finally {
      await db.delete(roadmapMilestones).where(eq(roadmapMilestones.slug, customSlug));
    }
  });

  it('runs Drizzle migrations idempotently and emits db.migrate_job.execution for applied and failed runs', async () => {
    const infoLogs: string[] = [];
    const errorLogs: string[] = [];
    const infoSpy = vi.spyOn(console, 'info').mockImplementation((msg: unknown) => {
      infoLogs.push(String(msg));
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation((msg: unknown) => {
      errorLogs.push(String(msg));
    });
    const badPool = createDbPool('postgres://postgres:postgres@127.0.0.1:1/unreachable');
    try {
      await runMigrationCli({ pool });
      expect(infoLogs.join('\n')).toContain('db.migrate_job.execution');
      expect(infoLogs.join('\n')).toContain('"status":"applied"');

      await expect(runMigrationCli({ pool: badPool })).rejects.toThrow(
        /Failed query|ECONNREFUSED|connect/i,
      );
      expect(errorLogs.join('\n')).toContain('db.migrate_job.execution');
      expect(errorLogs.join('\n')).toContain('"status":"failed"');
    } finally {
      await badPool.end();
      infoSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });

  it('enforces PG19 CHECK constraints, weighted career_dossiers search_tsv trigger, and Golden seed rows', async () => {
    let emailErr: unknown = null;
    try {
      await db.execute(sql`
        INSERT INTO contact_submissions (name, email, message)
        VALUES ('Margaret Hamilton', 'not-an-email', 'Valid message content for email check test.')
      `);
    } catch (error) {
      emailErr = error;
    }
    expect(extractPgError(emailErr)).toMatchObject({
      code: '23514',
      constraint: 'contact_email_format_check',
    });

    const bypassSlug = `pg-bypass-${Date.now()}`;
    let bypassErr: unknown = null;
    try {
      await db.execute(sql`
        INSERT INTO career_dossiers (
          slug, kind, title, domain_label, role_title, timeframe,
          summary_body, publish_status, sanitization_verified_at
        ) VALUES (
          ${bypassSlug}, 'experience', 'Bypass', 'Domain', 'Role', '2025',
          'Summary', 'published', NULL
        )
      `);
    } catch (err) {
      bypassErr = err;
    } finally {
      await db.delete(careerDossiers).where(eq(careerDossiers.slug, bypassSlug));
    }
    expect(extractPgError(bypassErr)).toMatchObject({
      code: '23514',
      constraint: 'career_dossiers_published_verified_check',
    });

    const lexicalMatch = await db.execute(sql`
      SELECT slug FROM career_dossiers
      WHERE publish_status = 'published'
        AND (
          search_tsv @@ websearch_to_tsquery('simple', 'Go TypeScript')
          OR search_tsv @@ websearch_to_tsquery('english', 'Go TypeScript')
        )
    `);
    expect(lexicalMatch.rows.length).toBeGreaterThan(0);

    const okPromptId = '66666666-6666-4666-8666-666666666669';
    const overPromptId = '77777777-7777-4777-8777-777777777779';
    const future = new Date(Date.now() + 300_000);
    try {
      await db.insert(askTurns).values({
        attemptId: okPromptId,
        sessionId: 'guest_len_check',
        role: 'guest',
        mode: 'qa',
        promptHash: 'e'.repeat(64),
        status: 'failed',
        errorCode: 'ERR_STREAM_ABORTED',
        correlationId: 'corr-len-1000',
        promptText: 'a'.repeat(1000),
        leaseExpiresAt: future,
        expiresAt: future,
      });

      let lenErr: unknown = null;
      try {
        await db.insert(askTurns).values({
          attemptId: overPromptId,
          sessionId: 'guest_len_check',
          role: 'guest',
          mode: 'qa',
          promptHash: 'f'.repeat(64),
          status: 'failed',
          errorCode: 'ERR_STREAM_ABORTED',
          correlationId: 'corr-len-1001',
          promptText: 'a'.repeat(1001),
          leaseExpiresAt: future,
          expiresAt: future,
        });
      } catch (err) {
        lenErr = err;
      }
      expect(extractPgError(lenErr)).toMatchObject({
        code: '23514',
        constraint: 'ask_turns_prompt_text_length_check',
      });
    } finally {
      await db.delete(askTurns).where(eq(askTurns.attemptId, okPromptId));
      await db.delete(askTurns).where(eq(askTurns.attemptId, overPromptId));
    }

    const presetsRes = await pool.query<{ slug: string }>(
      `SELECT slug FROM cadence_presets ORDER BY sort_order ASC`,
    );
    expect(presetsRes.rows.map(r => r.slug)).toEqual(CADENCE_PRESET_SEEDS.map(p => p.slug));

    const goldenRes = await pool.query<{ id: string }>(
      `SELECT id FROM sandbox_runs WHERE is_golden = true`,
    );
    expect(goldenRes.rows).toHaveLength(5);
  });

  it('enforces Go privacy-check pre-write fail-closed sanitization on seedDatabase, merges bootstrap /about navigation, and seeds Argon2id admin password', async () => {
    const prodDenylist = JSON.stringify(['SyntheticConfidentialClientX']);
    const testHandle = `seed_admin_${Date.now()}`;

    try {
      // 1. Production seedDatabase fails closed before mutating PG19 when DOSSIER_PRIVACY_DENYLIST is unset
      await expect(
        seedDatabase(db, {
          mode: 'upsert',
          env: {
            ADMIN_PASSWORD: '',
            NODE_ENV: 'production',
            DOSSIER_PRIVACY_DENYLIST: '',
          },
        }),
      ).rejects.toSatisfy(
        (err: unknown) =>
          err instanceof PrivacySanitizationError &&
          err.status === 422 &&
          err.findings.some(f => f.ruleId === 'config.denylist_empty_in_prod'),
      );

      // 2. Poisoned siteContentSeeds aborts pre-write with zero DB mutations
      await expect(
        seedDatabase(db, {
          mode: 'upsert',
          env: { ADMIN_PASSWORD: '', DOSSIER_PRIVACY_DENYLIST: prodDenylist },
          siteContentSeeds: [
            {
              key: SITE_CONTENT_KEYS.portalAbout,
              markdownBody: 'Clean',
              metadataJson: {
                ...PORTAL_ABOUT_SEED,
                description: 'Synthetic phone (555) 010-1234 should abort pre-write',
              },
            },
          ],
        }),
      ).rejects.toBeInstanceOf(PrivacySanitizationError);

      // 3. Poisoned mid-batch careerDossierSeeds aborts pre-write before mutating clean entries
      const firstSeed = CAREER_DOSSIER_SEEDS[0]!;
      const secondSeed = CAREER_DOSSIER_SEEDS[1]!;
      await expect(
        seedDatabase(db, {
          mode: 'upsert',
          env: { ADMIN_PASSWORD: '', DOSSIER_PRIVACY_DENYLIST: prodDenylist },
          careerDossierSeeds: [
            { ...firstSeed, title: 'Should Never Commit Before Poisoned Entry' },
            {
              ...secondSeed,
              summaryBody:
                'Poisoned mid-batch dossier for SyntheticConfidentialClientX at (555) 010-1234.',
            },
          ],
        }),
      ).rejects.toBeInstanceOf(PrivacySanitizationError);

      const untouched = await pool.query<{ title: string }>(
        `SELECT title FROM career_dossiers WHERE slug = $1`,
        [firstSeed.slug],
      );
      expect(untouched.rows[0]?.title).toBe(firstSeed.title);

      // 4. Bootstrap mode additively merges /about navigation without overwriting operator portal-home copy
      await pool.query(`DELETE FROM site_content WHERE key = 'portal-about'`);
      await pool.query(
        `UPDATE terminal_commands SET allowed_routes = ARRAY['cadence', 'chat', 'agensi', 'contact']
         WHERE profile_slug = 'portal-home' AND name = 'cd'`,
      );
      await pool.query(
        `UPDATE terminal_profiles SET quick_commands = ARRAY['ls', 'tui', 'cadence', 'chat']
         WHERE slug = 'portal-home'`,
      );
      const homeRow = await pool.query<{ metadata_json: Record<string, unknown> }>(
        `SELECT metadata_json FROM site_content WHERE key = 'portal-home'`,
      );
      const currentMeta = homeRow.rows[0]?.metadata_json ?? {};
      const existingActions = Array.isArray(currentMeta['actions'])
        ? (currentMeta['actions'] as Array<Record<string, unknown>>).filter(
            a => a['to'] !== '/about',
          )
        : [];
      await pool.query(
        `UPDATE site_content SET metadata_json = $1::jsonb WHERE key = 'portal-home'`,
        [
          JSON.stringify({
            ...currentMeta,
            tuiTitle: 'Custom Operator Launcher Title',
            actions: existingActions,
          }),
        ],
      );

      await seedDatabase(db, {
        mode: 'bootstrap',
        env: {
          ADMIN_PASSWORD: '',
          NODE_ENV: 'production',
          DOSSIER_PRIVACY_DENYLIST: prodDenylist,
        },
      });

      const cdRow = await pool.query<{ allowed_routes: string[] }>(
        `SELECT allowed_routes FROM terminal_commands WHERE profile_slug = 'portal-home' AND name = 'cd'`,
      );
      expect(cdRow.rows[0]?.allowed_routes).toContain('about');

      const updatedHome = await pool.query<{ metadata_json: Record<string, unknown> }>(
        `SELECT metadata_json FROM site_content WHERE key = 'portal-home'`,
      );
      expect(updatedHome.rows[0]?.metadata_json['tuiTitle']).toBe('Custom Operator Launcher Title');
      const updatedActions = (updatedHome.rows[0]?.metadata_json['actions'] ?? []) as Array<
        Record<string, unknown>
      >;
      expect(updatedActions.some(a => a['to'] === '/about')).toBe(true);

      // 5. seedAdminUserFromEnv hashes Argon2id and upserts idempotently
      const seeded = await seedAdminUserFromEnv(db, {
        ADMIN_HANDLE: testHandle,
        ADMIN_PASSWORD: 'OfflineSeedPassword!2026',
      });
      expect(seeded).toEqual({ seeded: true, handle: testHandle, action: 'inserted' });
      const user = await findAdminUserForPasswordLogin(db, testHandle);
      expect(user?.passwordHashArgon2).toMatch(/^\$argon2id\$/);
      expect(
        await verifyPasswordArgon2id('OfflineSeedPassword!2026', user?.passwordHashArgon2 ?? ''),
      ).toBe(true);
    } finally {
      await db.delete(users).where(eq(users.handle, testHandle));
      await seedDatabase(db, {
        mode: 'upsert',
        env: { ADMIN_PASSWORD: '', NODE_ENV: 'test', DOSSIER_PRIVACY_DENYLIST: prodDenylist },
      });
    }
  });

  it('applies 0010 visitor analytics enrichment from 0009 baseline, rolls back cleanly, and reapplies idempotently', async () => {
    const baseUrl = process.env['DATABASE_URL'];
    if (!baseUrl) {
      throw new Error('DATABASE_URL is required for 0010 migration verification');
    }

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
    const up0010 = readFileSync(
      resolve(drizzleDir, '0010_visitor_analytics_enrichment.sql'),
      'utf8',
    );
    const down0010 = readFileSync(
      resolve(drizzleDir, '0010_visitor_analytics_enrichment.down.sql'),
      'utf8',
    );

    const tempPre0010Dir = mkdtempSync(resolve(tmpdir(), 'aklapper-pre0010-'));
    const tempMetaDir = resolve(tempPre0010Dir, 'meta');
    mkdirSync(tempMetaDir, { recursive: true });
    const pre0010Entries = fullJournal.entries.filter(entry => entry.idx <= 9);
    for (const entry of pre0010Entries) {
      copyFileSync(
        resolve(drizzleDir, `${entry.tag}.sql`),
        resolve(tempPre0010Dir, `${entry.tag}.sql`),
      );
    }
    writeFileSync(
      resolve(tempMetaDir, '_journal.json'),
      JSON.stringify({ ...fullJournal, entries: pre0010Entries }, null, 2),
      'utf8',
    );

    const isolatedDbName = `migration_0010_verify_${Date.now()}`;
    const isolatedUrl = new URL(baseUrl);
    isolatedUrl.pathname = `/${isolatedDbName}`;
    let isoPool: Pool | null = null;

    await pool.query(`CREATE DATABASE "${isolatedDbName}"`);
    try {
      isoPool = createDbPool(isolatedUrl.toString());
      isoPool.on('error', (err: unknown) => {
        const code =
          typeof err === 'object' && err !== null && 'code' in err ? err.code : undefined;
        if (code !== '57P01') throw err;
      });
      const isoDb = createDb(isoPool);

      const getTableColumns = async (tableName: string): Promise<string[]> => {
        const res = await isoPool!.query<{ column_name: string }>(
          `SELECT column_name FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = $1`,
          [tableName],
        );
        return res.rows.map(row => row.column_name);
      };

      await runMigrations(isoDb, tempPre0010Dir);
      expect(await getTableColumns('analytics_sessions')).toHaveLength(6);

      await isoPool.query(up0010);
      await isoPool.query(up0010);
      expect(await getTableColumns('analytics_sessions')).toContain('visitor_hash');
      expect(await getTableColumns('contact_submissions')).toContain('analytics_session_id');

      await isoPool.query(down0010);
      expect(await getTableColumns('analytics_sessions')).toHaveLength(6);
      expect(await getTableColumns('contact_submissions')).not.toContain('analytics_session_id');

      await isoPool.query(up0010);
      expect(await getTableColumns('analytics_sessions')).toContain('visitor_hash');
      expect(await getTableColumns('contact_submissions')).toContain('analytics_session_id');
    } finally {
      if (isoPool) {
        await isoPool.end().catch(() => {});
      }
      await pool.query(`DROP DATABASE IF EXISTS "${isolatedDbName}" WITH (FORCE)`).catch(() => {});
      rmSync(tempPre0010Dir, { recursive: true, force: true });
    }
  });
});
