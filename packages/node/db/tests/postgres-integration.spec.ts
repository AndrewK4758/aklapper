import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { eq, sql } from 'drizzle-orm';
import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  type AppDatabase,
  askTurns,
  consumeQuotaForSession,
  ContactDbConstraintError,
  createDb,
  createDbPool,
  deleteTerminalDirectoryEntry,
  extractPgConstraintViolation,
  getAskTurnByAttemptId,
  getTerminalDirectoryEntries,
  getTerminalProfile,
  insertContactSubmission,
  loadAdminCmsData,
  loadAdminOverviewData,
  pruneExpiredAskTurns,
  rateLimitBuckets,
  resetRateLimitBucket,
  roadmapMilestones,
  seedDatabase,
  TERMINAL_PROFILE_SLUGS,
  upsertTerminalDirectoryEntry,
} from '../src/index.ts';
import { runMigrationCli } from '../src/migrate.ts';

describe('@aklapper/db PostgreSQL 19 integration (ephemeral container)', () => {
  let pool: Pool;
  let db: AppDatabase;

  beforeAll(() => {
    pool = createDbPool();
    db = createDb(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  it('serves the clean DB-driven portal-home ls listing from terminal_directory_entries', async () => {
    const entries = await getTerminalDirectoryEntries(db, TERMINAL_PROFILE_SLUGS.portalHome);
    expect(entries.map(entry => [entry.name, entry.description])).toEqual([
      ['menu', 'Site menu'],
      ['tui', 'TUI version'],
      ['cadence', 'Agentic workflow example'],
      ['ask', 'Ask about my work'],
      ['agensi', 'Published AI skills'],
      ['contact', 'Connect with me'],
      ['changes-in-progress', 'Maintenance preview'],
    ]);

    const expectedListing = [
      'menu                  # Site menu',
      'tui                   # TUI version',
      'cadence               # Agentic workflow example',
      'ask                   # Ask about my work',
      'agensi                # Published AI skills',
      'contact               # Connect with me',
      'changes-in-progress   # Maintenance preview',
    ].join('\n');

    const profile = await getTerminalProfile(db, TERMINAL_PROFILE_SLUGS.portalHome);
    expect(profile.initialEntries[0]?.command).toBe('ls');
    expect(profile.initialEntries[0]?.output).toBe(expectedListing);
    expect(profile.commands.find(cmd => cmd.name === 'ls')?.output).toBe(expectedListing);
    expect(profile.initialEntries[0]?.output).not.toMatch(/drwxr-xr-x|-rw-r--r--|menu\//);
  });

  it('dynamically reflects terminal_directory_entries mutations in getTerminalProfile and Admin CMS', async () => {
    const inserted = await upsertTerminalDirectoryEntry(db, {
      profileSlug: TERMINAL_PROFILE_SLUGS.portalHome,
      name: 'status-board',
      description: 'Live cluster health',
      sortOrder: 99,
      enabled: true,
    });

    try {
      const updatedProfile = await getTerminalProfile(db, TERMINAL_PROFILE_SLUGS.portalHome);
      expect(updatedProfile.initialEntries[0]?.output).toContain(
        'status-board          # Live cluster health',
      );
      expect(updatedProfile.commands.find(cmd => cmd.name === 'ls')?.output).toContain(
        'status-board          # Live cluster health',
      );

      const cms = await loadAdminCmsData(db);
      expect(cms.terminalDirectoryEntries.some(entry => entry.name === 'status-board')).toBe(true);
    } finally {
      const deleted = await deleteTerminalDirectoryEntry(db, inserted.id);
      expect(deleted).toBe(true);
    }

    const restoredProfile = await getTerminalProfile(db, TERMINAL_PROFILE_SLUGS.portalHome);
    expect(restoredProfile.initialEntries[0]?.output).not.toContain('status-board');
  });

  it('persists valid contact submissions and enforces PostgreSQL 19 CHECK constraints', async () => {
    const saved = await insertContactSubmission(db, {
      name: 'Margaret Hamilton',
      phone: '+1 (555) 123-4567',
      email: 'margaret@apollo.example',
      message: 'Testing real Postgres 19 persistence and CHECK constraint enforcement.',
      attachment: null,
    });

    expect(saved.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(saved.email).toBe('margaret@apollo.example');

    let pgError: unknown = null;
    try {
      await db.execute(sql`
        INSERT INTO contact_submissions (name, email, message)
        VALUES ('Margaret Hamilton', 'not-an-email', 'Valid message content for email check test.')
      `);
    } catch (error) {
      pgError = error;
    }

    const mapped = extractPgConstraintViolation(pgError);
    expect(mapped).toBeInstanceOf(ContactDbConstraintError);
    expect(mapped?.constraintName).toBe('contact_email_format_check');
    expect(mapped?.fieldErrors['email']).toBeTruthy();
  });

  it('serializes concurrent quota mutations via FOR UPDATE and enforces ask_turns lifecycle and Admin status detail', async () => {
    const overview = await loadAdminOverviewData(db);
    expect(overview.health.qdrant.detail).toBe('AI_ASK_URL not configured (fail-closed)');

    const sessionId = `guest_for_update_${Date.now()}`;
    const todayKey = `global:${new Date().toISOString().slice(0, 10)}`;

    try {
      const results = await Promise.all(
        Array.from({ length: 7 }, () => consumeQuotaForSession(db, 'guest', sessionId, 1, 512)),
      );
      const allowedCount = results.filter(r => r.allowed).length;
      const rejectedCount = results.filter(r => !r.allowed).length;
      expect(allowedCount).toBe(5);
      expect(rejectedCount).toBe(2);

      const [bucketRow] = await db
        .select()
        .from(rateLimitBuckets)
        .where(eq(rateLimitBuckets.scopeKey, `session:${sessionId}`))
        .limit(1);
      expect(bucketRow?.turnsUsed).toBe(5);
      expect(bucketRow?.tokensUsed).toBe(5 * 512);
    } finally {
      await resetRateLimitBucket(db, `session:${sessionId}`);
      await resetRateLimitBucket(db, todayKey);
    }

    const activeAttemptId = '11111111-1111-4111-8111-111111111119';
    const expiredAttemptId = '22222222-2222-4222-8222-222222222229';
    const now = new Date();
    const futureLease = new Date(now.getTime() + 60_000);
    const futureExpiry = new Date(now.getTime() + 900_000);
    const pastExpiry = new Date(now.getTime() - 60_000);

    try {
      await db.insert(askTurns).values([
        {
          attemptId: activeAttemptId,
          sessionId: 'guest_turn_owner',
          role: 'guest',
          mode: 'qa',
          promptHash: 'a'.repeat(64),
          status: 'completed',
          tokensReserved: 512,
          tokensUsed: 320,
          resultJson: {
            attemptId: activeAttemptId,
            grounded: true,
            abstained: false,
            mode: 'qa',
            answer: 'Grounded portfolio overview.',
            sources: [],
            provider: 'local-llama-swap',
            model: 'inference',
            tokensUsed: 320,
          },
          correlationId: 'corr-pg-turn-1',
          leaseExpiresAt: futureLease,
          expiresAt: futureExpiry,
        },
        {
          attemptId: expiredAttemptId,
          sessionId: 'guest_turn_owner',
          role: 'guest',
          mode: 'qa',
          promptHash: 'b'.repeat(64),
          status: 'running',
          tokensReserved: 512,
          tokensUsed: 0,
          correlationId: 'corr-pg-turn-2',
          leaseExpiresAt: pastExpiry,
          expiresAt: pastExpiry,
        },
      ]);

      const owned = await getAskTurnByAttemptId(db, activeAttemptId, 'guest_turn_owner');
      expect(owned?.status).toBe('completed');
      expect(owned?.response?.tokensUsed).toBe(320);

      const crossSession = await getAskTurnByAttemptId(db, activeAttemptId, 'guest_other');
      expect(crossSession).toBeNull();

      const pruned = await pruneExpiredAskTurns(db, now);
      expect(pruned).toBeGreaterThanOrEqual(1);
      expect(await getAskTurnByAttemptId(db, expiredAttemptId, 'guest_turn_owner')).toBeNull();
    } finally {
      await db.delete(askTurns).where(eq(askTurns.attemptId, activeAttemptId));
      await db.delete(askTurns).where(eq(askTurns.attemptId, expiredAttemptId));
    }
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
});
