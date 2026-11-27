import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import {
  computeTotpCode,
  encryptTotpSecret,
  generateBackupCodes,
  generateTotpSecret,
  hashBackupCode,
  hashPasswordArgon2id,
} from '@aklapper/node-runtime/auth';
import { PrivacySanitizationError } from '@aklapper/node-runtime/privacy';
import type { SsrStructuredLogger } from '@aklapper/node-runtime/ssr/stream';
import { eq, sql } from 'drizzle-orm';
import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  type AppDatabase,
  analyticsEvents,
  analyticsSessions,
  askTurns,
  bindGuestSessionToAnalyticsSession,
  CADENCE_PRESET_SEEDS,
  capturePortalSsrHit,
  CAREER_DOSSIER_SEEDS,
  careerDossiers,
  claimPendingSandboxRun,
  cloneCachedSandboxRunForSession,
  completeSandboxRunRow,
  consumeQuotaForSession,
  consumeTotpBackupCode,
  ContactDbConstraintError,
  contactSubmissions,
  createDb,
  createDbPool,
  createPendingSandboxRunWithQuota,
  deleteCareerDossier,
  deleteContactSubmission,
  deleteTerminalDirectoryEntry,
  dispatchAuthAction,
  extractPgConstraintViolation,
  failSandboxRunRow,
  findCachedSandboxRun,
  getAskTurnByAttemptId,
  getCadencePresetBySlug,
  getCadencePresets,
  getCareerDossierBySlug,
  getQuotaStatusForSession,
  getSandboxRunWithTurnsById,
  getTerminalDirectoryEntries,
  getTerminalProfile,
  getUserTotpSecret,
  GoldenRunImmutableError,
  handleAdminAuthBffRequest,
  handleAnalyticsIngestRequest,
  insertContactSubmission,
  isNodeDevUnlimitedEnabled,
  listAdminSandboxRuns,
  listCareerDossiers,
  listContactSubmissions,
  listGoldenSandboxRuns,
  listPublishedCareerDossiers,
  listSandboxRunsForSession,
  loadAdminAnalyticsBreakdowns,
  loadAdminAnalyticsData,
  loadAdminAnalyticsSummary,
  loadAdminCmsData,
  loadAdminOverviewData,
  loadPortalAboutData,
  loadPortalAboutDataWithPrerender,
  loadPortalHomeData,
  loadPortalRootData,
  pruneExpiredAskTurns,
  publishCareerDossier,
  rateLimitBuckets,
  recordContactSubmittedAnalyticsEvent,
  resetRateLimitBucket,
  resolveOrCreateContactAnalyticsSession,
  roadmapMilestones,
  sandboxRuns,
  seedDatabase,
  SITE_CONTENT_KEYS,
  TERMINAL_PROFILE_SLUGS,
  unpublishCareerDossier,
  updateSandboxRunGateVerdictForSession,
  updateSandboxTurnRow,
  upsertAdminUserPassword,
  upsertCareerDossier,
  upsertCareerDossierBatch,
  upsertSiteContent,
  upsertTerminalDirectoryEntry,
  upsertUserTotpSecret,
  users,
} from '../src/index.ts';
import { runMigrationCli, runMigrations } from '../src/migrate.ts';

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
      ['about', 'Resume & platform services guide'],
      ['tui', 'TUI version'],
      ['cadence', 'Agentic workflow example'],
      ['chat', "Chat with Andrew's AI"],
      ['agensi', 'Published AI skills'],
      ['contact', 'Connect with me'],
    ]);

    const expectedListing = [
      'about     # Resume & platform services guide',
      'tui       # TUI version',
      'cadence   # Agentic workflow example',
      "chat      # Chat with Andrew's AI",
      'agensi    # Published AI skills',
      'contact   # Connect with me',
    ].join('\n');

    const profile = await getTerminalProfile(db, TERMINAL_PROFILE_SLUGS.portalHome);
    expect(profile.initialEntries[0]?.command).toBe('ls');
    expect(profile.initialEntries[0]?.output).toBe(expectedListing);
    expect(profile.commands.find(cmd => cmd.name === 'ls')?.output).toBe(expectedListing);
    expect(profile.initialEntries[0]?.output).not.toContain('changes-in-progress');
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
        'status-board   # Live cluster health',
      );
      expect(updatedProfile.commands.find(cmd => cmd.name === 'ls')?.output).toContain(
        'status-board   # Live cluster health',
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
        Array.from({ length: 12 }, () => consumeQuotaForSession(db, 'guest', sessionId, 1, 512)),
      );
      const allowedCount = results.filter(r => r.allowed).length;
      const rejectedCount = results.filter(r => !r.allowed).length;
      expect(allowedCount).toBe(10);
      expect(rejectedCount).toBe(2);

      const [bucketRow] = await db
        .select()
        .from(rateLimitBuckets)
        .where(eq(rateLimitBuckets.scopeKey, `session:${sessionId}`))
        .limit(1);
      expect(bucketRow?.turnsUsed).toBe(10);
      expect(bucketRow?.tokensUsed).toBe(10 * 512);
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
      const agedAttemptId = '33333333-3333-4333-8333-333333333333';
      const created20mAgo = new Date(now.getTime() - 20 * 60_000);
      const created91dAgo = new Date(now.getTime() - 91 * 86_400_000);

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
          status: 'completed',
          tokensReserved: 512,
          tokensUsed: 120,
          promptText: 'Recent terminal turn past 15m recovery TTL',
          correlationId: 'corr-pg-turn-2',
          createdAt: created20mAgo,
          leaseExpiresAt: pastExpiry,
          expiresAt: pastExpiry,
        },
        {
          attemptId: agedAttemptId,
          sessionId: 'guest_turn_owner',
          role: 'guest',
          mode: 'qa',
          promptHash: 'c'.repeat(64),
          status: 'completed',
          tokensReserved: 512,
          tokensUsed: 80,
          promptText: 'Aged terminal turn past 90d retention window',
          correlationId: 'corr-pg-turn-3',
          createdAt: created91dAgo,
          leaseExpiresAt: pastExpiry,
          expiresAt: pastExpiry,
        },
      ]);

      const owned = await getAskTurnByAttemptId(db, activeAttemptId, 'guest_turn_owner', now);
      expect(owned?.status).toBe('completed');
      expect(owned?.response?.tokensUsed).toBe(320);

      const crossSession = await getAskTurnByAttemptId(db, activeAttemptId, 'guest_other', now);
      expect(crossSession).toBeNull();

      // Recovery lookup strictly enforces 15-minute expires_at TTL even while row is retained for analytics
      expect(await getAskTurnByAttemptId(db, expiredAttemptId, 'guest_turn_owner', now)).toBeNull();

      // 90-day terminal pruning deletes only rows created > 90 days ago, keeping 20m-old row for analytics
      const pruned = await pruneExpiredAskTurns(db, now, 90);
      expect(pruned).toBeGreaterThanOrEqual(1);
      const remainingRows = await pool.query<{ attempt_id: string }>(
        `SELECT attempt_id FROM ask_turns WHERE attempt_id IN ($1, $2)`,
        [expiredAttemptId, agedAttemptId],
      );
      expect(remainingRows.rows.map(r => r.attempt_id)).toEqual([expiredAttemptId]);
    } finally {
      await db.delete(askTurns).where(eq(askTurns.attemptId, activeAttemptId));
      await db.delete(askTurns).where(eq(askTurns.attemptId, expiredAttemptId));
      await db
        .delete(askTurns)
        .where(eq(askTurns.attemptId, '33333333-3333-4333-8333-333333333333'));
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

  it('seeds all 5 buildable CADENCE presets and enforces atomic pending run lifecycle + CAS claim', async () => {
    const presets = await getCadencePresets(db);
    expect(presets.map(p => p.slug)).toEqual(CADENCE_PRESET_SEEDS.map(p => p.slug));
    expect(presets).toHaveLength(5);

    const workbench = await getCadencePresetBySlug(db, 'chord-decomposition-workbench');
    expect(workbench?.expectedKind).toBe('chord-workbench');

    const sessionId = `pg19-test-${Date.now()}`;
    try {
      const init = await createPendingSandboxRunWithQuota(db, {
        role: 'guest',
        sessionId,
        ipHash: 'test-ip',
        presetSlug: 'chord-decomposition-workbench',
        prompt: 'Measure CHORD stage latency across replicas in fast mode.',
        mode: 'fast',
        estimatedTokens: 800,
      });

      expect(init.allowed).toBe(true);
      expect(init.run?.runStatus).toBe('pending');
      expect(init.run?.mode).toBe('fast');
      expect(init.run?.presetSlug).toBe('chord-decomposition-workbench');
      expect(init.run?.turns).toHaveLength(4);
      expect(init.quota.turnsUsed).toBe(1);

      const runId = init.run?.runId ?? '';
      expect(runId).toMatch(/^[0-9a-f-]{36}$/i);

      // Gate mutation before run reaches 'ready' returns conflict.
      const prematureGate = await updateSandboxRunGateVerdictForSession(
        db,
        runId,
        'approved',
        sessionId,
      );
      expect(prematureGate.outcome).toBe('conflict');

      // Concurrent CAS claims allow at most one worker to execute pending -> running.
      const [claimA, claimB] = await Promise.all([
        claimPendingSandboxRun(db, runId, sessionId),
        claimPendingSandboxRun(db, runId, sessionId),
      ]);
      const winners = [claimA, claimB].filter(Boolean);
      expect(winners).toHaveLength(1);
      expect(winners[0]?.mode).toBe('fast');

      // Updating triage turn preserves persisted mode metadata.
      await updateSandboxTurnRow(db, {
        runId,
        phase: 'triage',
        status: 'completed',
        summary: 'Classified fast-mode prompt',
        latencyMs: 2,
      });

      const completed = await completeSandboxRunRow(db, {
        runId,
        tokensIn: 140,
        tokensOut: 320,
        artifactHtml: '<!doctype html><html><body>OK</body></html>',
      });
      expect(completed?.runStatus).toBe('ready');
      expect(completed?.mode).toBe('fast');
      expect(completed?.presetSlug).toBe('chord-decomposition-workbench');

      // Cross-session gate verdict is rejected fail-closed.
      const wrongSessionGate = await updateSandboxRunGateVerdictForSession(
        db,
        runId,
        'approved',
        'wrong-session-id',
      );
      expect(wrongSessionGate.outcome).toBe('forbidden');

      const approvedGate = await updateSandboxRunGateVerdictForSession(
        db,
        runId,
        'approved',
        sessionId,
      );
      expect(approvedGate).toMatchObject({
        outcome: 'ok',
        run: { gateVerdict: 'approved' },
      });

      // Reload history returns runStatus, mode, and presetSlug.
      const history = await listSandboxRunsForSession(db, sessionId, 5);
      expect(history[0]?.runStatus).toBe('ready');
      expect(history[0]?.presetSlug).toBe('chord-decomposition-workbench');

      // Exhaust remaining 9 guest turns (10-turn guest cap), then verify 11th rejects with zero orphan rows.
      for (let i = 0; i < 9; i++) {
        const nextInit = await createPendingSandboxRunWithQuota(db, {
          role: 'guest',
          sessionId,
          ipHash: 'test-ip',
          presetSlug: 'custom',
          prompt: `Quota turn filler ${i + 2} validating transaction integrity`,
          mode: 'fast',
        });
        expect(nextInit.allowed).toBe(true);
      }

      const exhausted = await createPendingSandboxRunWithQuota(db, {
        role: 'guest',
        sessionId,
        ipHash: 'test-ip',
        presetSlug: 'custom',
        prompt: 'Eleventh request must fail quota cleanly with zero orphan runs',
        mode: 'fast',
      });
      expect(exhausted.allowed).toBe(false);
      expect(exhausted.run).toBeNull();
      expect(exhausted.quota.turnsUsed).toBe(10);

      const rowsForSession = await db
        .select()
        .from(sandboxRuns)
        .where(eq(sandboxRuns.sessionId, sessionId));
      expect(rowsForSession).toHaveLength(10);

      // Verify failSandboxRunRow marks a run failed cleanly.
      const extraRunId = rowsForSession[1]?.id ?? '';
      expect(extraRunId).toMatch(/^[0-9a-f-]{36}$/i);
      await failSandboxRunRow(db, extraRunId, 'Simulated stream abort');
      const failed = await getSandboxRunWithTurnsById(db, extraRunId);
      expect(failed?.run.runStatus).toBe('failed');

      const quota = await getQuotaStatusForSession(db, 'guest', sessionId);
      expect(quota.turnsUsed).toBe(10);
    } finally {
      await db.delete(sandboxRuns).where(eq(sandboxRuns.sessionId, sessionId));
      await db
        .delete(rateLimitBuckets)
        .where(eq(rateLimitBuckets.scopeKey, `session:${sessionId}`));
    }
  });

  it('enforces career_dossiers privacy guard, trigger search_tsv acronyms, SQL CHECK constraints, and ERR_STREAM_ABORTED/ERR_FORBIDDEN turn mapping', async () => {
    const slug = `pg-dossier-${Date.now()}`;
    const denylistV1 = Buffer.from(
      JSON.stringify(['SyntheticConfidentialClientX']),
      'utf8',
    ).toString('base64');
    const denylistV2 = Buffer.from(
      JSON.stringify(['SyntheticConfidentialClientX', 'RotatingSecretTermY']),
      'utf8',
    ).toString('base64');

    // Seeded baseline profile_core exists and is published
    const seeded = await getCareerDossierBySlug(db, 'andrew-klapper-profile-core');
    expect(seeded?.publishStatus).toBe('published');
    expect(seeded?.kind).toBe('profile_core');

    // Direct persistence guard blocks denylist terms on career_dossiers AND site_content['portal-ask']
    await expect(
      upsertCareerDossier(
        db,
        {
          slug,
          kind: 'architecture',
          title: 'Blocked Draft',
          domainLabel: 'Cloud',
          roleTitle: 'Architect',
          timeframe: '2025',
          skills: ['K8s'],
          summaryBody: 'Contains SyntheticConfidentialClientX which must fail closed.',
          sections: [],
          sortOrder: 5,
        },
        { rawDenylist: denylistV1 },
      ),
    ).rejects.toBeInstanceOf(PrivacySanitizationError);

    const prevEnvDenylist = process.env['DOSSIER_PRIVACY_DENYLIST'];
    process.env['DOSSIER_PRIVACY_DENYLIST'] = denylistV1;
    try {
      await expect(
        upsertSiteContent(db, SITE_CONTENT_KEYS.portalAsk, 'Clean body', {
          windowTitle: 'Ask Portfolio',
          statusBadge: { source: 'svc-ai-ask', state: 'idle', label: 'Ready' },
          description: 'Mentions SyntheticConfidentialClientX',
          starterQuestions: ['Question 1'],
          jdPlaceholder: 'Paste JD',
          abstentionNotice: 'Grounded only.',
        }),
      ).rejects.toBeInstanceOf(PrivacySanitizationError);
    } finally {
      if (prevEnvDenylist === undefined) delete process.env['DOSSIER_PRIVACY_DENYLIST'];
      else process.env['DOSSIER_PRIVACY_DENYLIST'] = prevEnvDenylist;
    }

    try {
      const savedDraft = await upsertCareerDossier(
        db,
        {
          slug,
          kind: 'architecture',
          title: 'Multi-Region gRPC Platform',
          domainLabel: 'Cloud Infrastructure',
          roleTitle: 'Principal Engineer',
          timeframe: '2024-2026',
          skills: ['K8s', 'gRPC', 'PG19', 'OAuth2'],
          summaryBody: 'Built high-throughput services with RotatingSecretTermY observability.',
          sections: [
            {
              heading: 'Lexical Trigger Verification',
              body: 'Verifies weighted tsvector matching across acronyms and section bodies.',
            },
          ],
          sortOrder: 40,
        },
        { rawDenylist: denylistV1 },
      );
      expect(savedDraft.publishStatus).toBe('draft');
      expect(savedDraft.sanitizationVerifiedAt).toBeTruthy();

      // Draft is excluded from listPublishedCareerDossiers
      const publishedBefore = await listPublishedCareerDossiers(db);
      expect(publishedBefore.some(d => d.slug === slug)).toBe(false);
      expect((await listCareerDossiers(db)).some(d => d.slug === slug)).toBe(true);

      // Production publish fails closed when denylist is empty
      await expect(
        publishCareerDossier(db, slug, {
          rawDenylist: '',
          env: { NODE_ENV: 'production' },
        }),
      ).rejects.toBeInstanceOf(PrivacySanitizationError);

      // Rotated denylist catches newly blocked term in previously saved draft at publish time
      await expect(
        publishCareerDossier(db, slug, {
          rawDenylist: denylistV2,
          env: { NODE_ENV: 'production' },
        }),
      ).rejects.toBeInstanceOf(PrivacySanitizationError);

      // Clean publish under v1 denylist succeeds
      const published = await publishCareerDossier(db, slug, {
        rawDenylist: denylistV1,
        env: { NODE_ENV: 'production' },
      });
      expect(published?.publishStatus).toBe('published');

      // Dual-dictionary search_tsv trigger matches technical acronyms K8s / gRPC / PG19 / OAuth2
      const lexicalMatch = await db.execute(sql`
        SELECT slug FROM career_dossiers
        WHERE slug = ${slug}
          AND (
            search_tsv @@ websearch_to_tsquery('simple', 'gRPC PG19 OAuth2')
            OR search_tsv @@ websearch_to_tsquery('english', 'gRPC PG19 OAuth2')
          )
      `);
      expect(lexicalMatch.rows).toHaveLength(1);

      // Direct SQL bypass (published without sanitization_verified_at) fails with SQLSTATE 23514
      let checkErr: unknown = null;
      try {
        await db.execute(sql`
          INSERT INTO career_dossiers (
            slug, kind, title, domain_label, role_title, timeframe,
            summary_body, publish_status, sanitization_verified_at
          ) VALUES (
            ${`${slug}-bypass`}, 'experience', 'Bypass', 'Domain', 'Role', '2025',
            'Summary', 'published', NULL
          )
        `);
      } catch (err) {
        checkErr = err;
      }
      expect(extractPgConstraintViolation(checkErr)?.constraintName).toBe(
        'career_dossiers_published_verified_check',
      );

      // Unpublish transitions back to draft immediately
      const unpublished = await unpublishCareerDossier(db, slug);
      expect(unpublished?.publishStatus).toBe('draft');
      expect((await listPublishedCareerDossiers(db)).some(d => d.slug === slug)).toBe(false);
    } finally {
      await deleteCareerDossier(db, slug);
      await db.delete(careerDossiers).where(eq(careerDossiers.slug, `${slug}-bypass`));
    }

    // ERR_STREAM_ABORTED -> 499 and ERR_FORBIDDEN -> 403 mapping on ask_turns recovery
    const abortedAttemptId = '33333333-3333-4333-8333-333333333339';
    const forbiddenAttemptId = '44444444-4444-4444-8444-444444444449';
    const convId = '55555555-5555-4555-8555-555555555559';
    const now = new Date();
    const future = new Date(now.getTime() + 300_000);
    try {
      await db.insert(askTurns).values([
        {
          attemptId: abortedAttemptId,
          sessionId: 'guest_err_map',
          role: 'guest',
          mode: 'qa',
          promptHash: 'c'.repeat(64),
          status: 'failed',
          errorCode: 'ERR_STREAM_ABORTED',
          correlationId: 'corr-aborted-499',
          conversationId: convId,
          turnIndex: 1,
          promptText: 'Cancelled turn prompt',
          leaseExpiresAt: future,
          expiresAt: future,
        },
        {
          attemptId: forbiddenAttemptId,
          sessionId: 'guest_err_map',
          role: 'guest',
          mode: 'qa',
          promptHash: 'd'.repeat(64),
          status: 'failed',
          errorCode: 'ERR_FORBIDDEN',
          correlationId: 'corr-forbidden-403',
          conversationId: convId,
          turnIndex: 2,
          leaseExpiresAt: future,
          expiresAt: future,
        },
      ]);

      const abortedState = await getAskTurnByAttemptId(db, abortedAttemptId, 'guest_err_map');
      expect(abortedState?.conversationId).toBe(convId);
      expect(abortedState?.turnIndex).toBe(1);
      expect(abortedState?.error?.code).toBe('ERR_STREAM_ABORTED');
      expect(abortedState?.error?.status).toBe(499);

      const forbiddenState = await getAskTurnByAttemptId(db, forbiddenAttemptId, 'guest_err_map');
      expect(forbiddenState?.error?.code).toBe('ERR_FORBIDDEN');
      expect(forbiddenState?.error?.status).toBe(403);

      // S-3.3: ask_turns_prompt_text_length_check accepts 1000 chars and rejects 1001 chars (SQLSTATE 23514)
      const okPromptId = '66666666-6666-4666-8666-666666666669';
      const overPromptId = '77777777-7777-4777-8777-777777777779';
      try {
        await db.insert(askTurns).values({
          attemptId: okPromptId,
          sessionId: 'guest_err_map',
          role: 'guest',
          mode: 'qa',
          promptHash: 'e'.repeat(64),
          status: 'failed',
          errorCode: 'ERR_STREAM_ABORTED',
          correlationId: 'corr-len-1000',
          conversationId: convId,
          turnIndex: 3,
          promptText: 'a'.repeat(1000),
          leaseExpiresAt: future,
          expiresAt: future,
        });

        let lenErr: unknown = null;
        try {
          await db.insert(askTurns).values({
            attemptId: overPromptId,
            sessionId: 'guest_err_map',
            role: 'guest',
            mode: 'qa',
            promptHash: 'f'.repeat(64),
            status: 'failed',
            errorCode: 'ERR_STREAM_ABORTED',
            correlationId: 'corr-len-1001',
            conversationId: convId,
            turnIndex: 4,
            promptText: 'a'.repeat(1001),
            leaseExpiresAt: future,
            expiresAt: future,
          });
        } catch (err) {
          lenErr = err;
        }
        expect(extractPgConstraintViolation(lenErr)?.constraintName).toBe(
          'ask_turns_prompt_text_length_check',
        );
      } finally {
        await db.delete(askTurns).where(eq(askTurns.attemptId, okPromptId));
        await db.delete(askTurns).where(eq(askTurns.attemptId, overPromptId));
      }
    } finally {
      await db.delete(askTurns).where(eq(askTurns.attemptId, abortedAttemptId));
      await db.delete(askTurns).where(eq(askTurns.attemptId, forbiddenAttemptId));
    }

    // Atomic batch upsert rejects 2-file batch when file #2 fails privacy with zero DB mutations
    const batchCleanSlug = `batch-clean-${Date.now()}`;
    const batchLeakySlug = `batch-leaky-${Date.now()}`;
    try {
      await expect(
        upsertCareerDossierBatch(
          db,
          [
            {
              slug: batchCleanSlug,
              kind: 'architecture',
              title: 'Clean File One',
              domainLabel: 'Cloud',
              roleTitle: 'Architect',
              timeframe: '2025',
              skills: ['Go'],
              summaryBody: 'Clean architectural summary.',
              sections: [],
              sortOrder: 0,
            },
            {
              slug: batchLeakySlug,
              kind: 'architecture',
              title: 'Leaky File Two',
              domainLabel: 'Cloud',
              roleTitle: 'Architect',
              timeframe: '2025',
              skills: ['Go'],
              summaryBody: 'Contains SyntheticConfidentialClientX which must abort whole batch.',
              sections: [],
              sortOrder: 0,
            },
          ],
          { rawDenylist: denylistV1 },
        ),
      ).rejects.toBeInstanceOf(PrivacySanitizationError);

      expect(await getCareerDossierBySlug(db, batchCleanSlug)).toBeNull();
      expect(await getCareerDossierBySlug(db, batchLeakySlug)).toBeNull();
    } finally {
      await deleteCareerDossier(db, batchCleanSlug);
      await deleteCareerDossier(db, batchLeakySlug);
    }

    // S-3.1: Reversible migration 0006 down -> up -> up round-trip preserving custom quota overrides
    const drizzleDir = resolve(import.meta.dirname, '../drizzle');
    const downSql = readFileSync(
      resolve(drizzleDir, '0006_career_dossiers_and_ask_turns.down.sql'),
      'utf8',
    );
    const upSql = readFileSync(
      resolve(drizzleDir, '0006_career_dossiers_and_ask_turns.sql'),
      'utf8',
    );
    expect(existsSync(resolve(drizzleDir, '0006_career_dossiers_and_ask_turns.down.sql'))).toBe(
      true,
    );
    await pool.query(downSql);
    await pool.query(upSql);
    await pool.query(upSql);
    await seedDatabase(db);
    const restoredCore = await getCareerDossierBySlug(db, 'andrew-klapper-profile-core');
    expect(restoredCore?.publishStatus).toBe('published');
  });

  it('seeds 5 Golden Showcases, enforces CHECK & 409 immutability, isolates admin metrics, clones $0 cache hits, and proves 0007 down -> up -> bootstrap reversibility', async () => {
    // 1. Verify 5 seeded Golden Showcase runs exist with 4 turns each and zero tokens.
    const goldenRuns = await listGoldenSandboxRuns(db);
    expect(goldenRuns).toHaveLength(5);
    expect(
      goldenRuns.every(
        r =>
          r.isGolden === true &&
          r.executionMode === 'golden' &&
          r.gateVerdict === 'approved' &&
          r.tokensIn === 0 &&
          r.tokensOut === 0 &&
          r.turns.length === 4 &&
          Boolean(r.spec) &&
          Boolean(r.gateAudit),
      ),
    ).toBe(true);

    const firstGoldenId = goldenRuns[0]?.runId ?? '';
    expect(firstGoldenId).toBe('00000000-0000-4000-8000-000000000101');

    // 2. SQL CHECK constraint blocks mutating Golden rows directly.
    let goldenCheckErr: unknown = null;
    try {
      await db.execute(sql`
        UPDATE sandbox_runs SET gate_verdict = 'rejected' WHERE id = ${firstGoldenId}::uuid
      `);
    } catch (err) {
      goldenCheckErr = err;
    }
    expect(extractPgConstraintViolation(goldenCheckErr)?.constraintName).toBe(
      'sandbox_runs_golden_immutable_check',
    );

    // 3. Node writer throws GoldenRunImmutableError (HTTP 409) on Golden gate mutation.
    await expect(
      updateSandboxRunGateVerdictForSession(db, firstGoldenId, 'rejected', 'golden-showcase'),
    ).rejects.toBeInstanceOf(GoldenRunImmutableError);

    // 4. Admin overview & admin sandbox list exclude Golden rows.
    const adminRuns = await listAdminSandboxRuns(db, 50);
    expect(adminRuns.some(r => r.runId === firstGoldenId)).toBe(false);

    // 5. Scoped prompt_hash cache hit clones a $0 session-owned row without debiting quota.
    const cacheSession = `cache-clone-sess-${Date.now()}`;
    try {
      const preset = CADENCE_PRESET_SEEDS[0];
      expect(preset).toBeDefined();
      const lookup = await findCachedSandboxRun(db, {
        sessionId: cacheSession,
        presetSlug: preset?.slug,
        mode: 'llm',
        prompt: `  ${preset?.starterPrompt.toUpperCase() ?? ''}  `,
      });
      expect(lookup.scope).toBe('preset_global_hit');
      expect(lookup.sourceRun?.id).toBe(firstGoldenId);

      const cloned = await cloneCachedSandboxRunForSession(
        db,
        { run: lookup.sourceRun!, turns: lookup.sourceTurns },
        {
          sessionId: cacheSession,
          ipHash: 'test-ip',
          presetSlug: preset?.slug,
          prompt: preset?.starterPrompt ?? '',
          promptHash: lookup.promptHash,
        },
      );
      expect(cloned.executionMode).toBe('cached');
      expect(cloned.isGolden).toBe(false);
      expect(cloned.tokensIn).toBe(0);
      expect(cloned.tokensOut).toBe(0);
      expect(cloned.gateVerdict).toBe('pending');
      expect(cloned.turns).toHaveLength(4);

      const quotaAfterClone = await getQuotaStatusForSession(db, 'guest', cacheSession);
      expect(quotaAfterClone.turnsUsed).toBe(0);

      // 6. Verify fail-closed AI_DEV_UNLIMITED parity in Node.
      expect(
        isNodeDevUnlimitedEnabled({
          AI_DEV_UNLIMITED: 'true',
          NODE_ENV: 'production',
          AI_PROVIDER: 'local',
        }),
      ).toBe(false);
      expect(
        isNodeDevUnlimitedEnabled({
          AI_DEV_UNLIMITED: 'true',
          NODE_ENV: 'development',
          AI_PROVIDER: 'vertex',
        }),
      ).toBe(false);
      expect(
        isNodeDevUnlimitedEnabled({
          AI_DEV_UNLIMITED: 'true',
          NODE_ENV: 'development',
          APP_ENV: 'development',
          AI_PROVIDER: 'local',
        }),
      ).toBe(true);

      // 7. Migration 0007 down -> up -> bootstrap reversibility preserves visitor row and cleans/restores Golden rows.
      const drizzleDir = resolve(import.meta.dirname, '../drizzle');
      const down0007 = readFileSync(
        resolve(drizzleDir, '0007_cadence_showcase_golden_and_cache.down.sql'),
        'utf8',
      );
      const up0007 = readFileSync(
        resolve(drizzleDir, '0007_cadence_showcase_golden_and_cache.sql'),
        'utf8',
      );
      await pool.query(down0007);
      const afterDown = await pool.query(
        `SELECT COUNT(*)::int AS cnt FROM sandbox_runs WHERE session_id = 'golden-showcase'`,
      );
      expect(Number(afterDown.rows[0]?.['cnt'])).toBe(0);
      const visitorSurvived = await pool.query(
        `SELECT COUNT(*)::int AS cnt FROM sandbox_runs WHERE id = $1::uuid`,
        [cloned.runId],
      );
      expect(Number(visitorSurvived.rows[0]?.['cnt'])).toBe(1);

      await pool.query(up0007);
      await seedDatabase(db, { mode: 'bootstrap', env: { ADMIN_PASSWORD: '' } });
      const restoredGolden = await listGoldenSandboxRuns(db);
      expect(restoredGolden).toHaveLength(5);
    } finally {
      await db.delete(sandboxRuns).where(eq(sandboxRuns.sessionId, cacheSession));
    }
  });

  it('excludes non-abstained general turns from admin abstention counts and prunes retired ask rows on upsert seed', async () => {
    const beforeOverview = await loadAdminAnalyticsSummary(db, 'all');
    const markerSession = `sess-general-analytics-${Date.now()}`;
    try {
      await pool.query(
        `INSERT INTO analytics_sessions (session_id, ip_hash) VALUES ($1, 'test-ip-hash') ON CONFLICT (session_id) DO NOTHING`,
        [markerSession],
      );
      await pool.query(
        `INSERT INTO analytics_events (session_id, type, name, path, metadata_json) VALUES
          ($1, 'interaction', 'ask_completed', '/chat', '{"grounded": false, "abstained": false, "groundingTier": "general"}'::jsonb),
          ($1, 'interaction', 'ask_abstained', '/chat', '{"grounded": false, "abstained": true, "groundingTier": "boundary"}'::jsonb)`,
        [markerSession],
      );
      const afterOverview = await loadAdminAnalyticsSummary(db, 'all');
      expect(afterOverview.aiMetrics.abstentionEvents).toBe(
        beforeOverview.aiMetrics.abstentionEvents + 1,
      );
    } finally {
      await pool.query(`DELETE FROM analytics_events WHERE session_id = $1`, [markerSession]);
      await pool.query(`DELETE FROM analytics_sessions WHERE session_id = $1`, [markerSession]);
    }

    // Inject legacy 'ask' rows and confirm idempotent upsert seed prunes them
    await pool.query(
      `INSERT INTO menu_items (slug, key_shortcut, title, description, sort_order, enabled)
       VALUES ('ask', '2', 'Legacy Ask', 'Retired', 2, true)
       ON CONFLICT (slug) DO NOTHING`,
    );
    await pool.query(
      `INSERT INTO terminal_commands (profile_slug, name, description, kind, output, target_route, allowed_routes, sort_order)
       VALUES ('portal-home', 'ask', 'Legacy ask', 'navigate', 'opening /ask ...', '/ask', '{}', 6)
       ON CONFLICT (profile_slug, name) DO NOTHING`,
    );
    await pool.query(
      `INSERT INTO terminal_directory_entries (profile_slug, name, description, sort_order, enabled)
       VALUES ('portal-home', 'ask', 'Legacy ask', 4, true)
       ON CONFLICT (profile_slug, name) DO NOTHING`,
    );

    await seedDatabase(db, { mode: 'upsert', env: { ADMIN_PASSWORD: '' } });
    await seedDatabase(db, { mode: 'upsert', env: { ADMIN_PASSWORD: '' } });

    const legacyMenu = await pool.query(`SELECT slug FROM menu_items WHERE slug = 'ask'`);
    const legacyCmd = await pool.query(
      `SELECT name FROM terminal_commands WHERE profile_slug = 'portal-home' AND name = 'ask'`,
    );
    const legacyDir = await pool.query(
      `SELECT name FROM terminal_directory_entries WHERE profile_slug = 'portal-home' AND name = 'ask'`,
    );
    expect(legacyMenu.rows).toHaveLength(0);
    expect(legacyCmd.rows).toHaveLength(0);
    expect(legacyDir.rows).toHaveLength(0);
  });

  it('atomically consumes TOTP backup codes across concurrent PostgreSQL 19 requests without replay or lost updates', async () => {
    const authEnv: Record<string, string> = {
      NODE_ENV: 'test',
      INTERNAL_AUTH_SECRET: 'pg-concurrent-totp-internal-secret',
      TOTP_ENCRYPTION_KEY: 'pg-concurrent-totp-aes-key',
    };
    const handle = `admin-backup-race-${Date.now()}`;
    const clientIp = '198.51.100.77';
    const ipHash = createHash('sha256').update(clientIp, 'utf8').digest('hex');

    const { user: directUser } = await upsertAdminUserPassword(db, {
      handle: `${handle}-direct`,
      passwordHashArgon2: await hashPasswordArgon2id('direct-race-pass'),
    });
    const { user: bffUser } = await upsertAdminUserPassword(db, {
      handle,
      passwordHashArgon2: await hashPasswordArgon2id('bff-race-pass'),
    });

    try {
      const directSecret = generateTotpSecret();
      const directHashes = generateBackupCodes(4).map(hashBackupCode);
      await upsertUserTotpSecret(db, {
        userId: directUser.id,
        encryptedSecret: encryptTotpSecret(directSecret, authEnv['TOTP_ENCRYPTION_KEY']),
        backupCodesHash: directHashes,
        enabled: true,
      });

      // 6 parallel attempts against the same hash allow exactly 1 winner
      const sameHashOutcomes = await Promise.all(
        Array.from({ length: 6 }, () => consumeTotpBackupCode(db, directUser.id, directHashes[0]!)),
      );
      expect(sameHashOutcomes.filter(Boolean)).toHaveLength(1);
      expect(sameHashOutcomes.filter(ok => !ok)).toHaveLength(5);

      const afterSameRace = await getUserTotpSecret(db, directUser.id);
      expect(afterSameRace?.backupCodesHash).toEqual(directHashes.slice(1));

      // 2 parallel attempts against distinct hashes remove both without lost update
      const distinctOutcomes = await Promise.all([
        consumeTotpBackupCode(db, directUser.id, directHashes[1]!),
        consumeTotpBackupCode(db, directUser.id, directHashes[2]!),
      ]);
      expect(distinctOutcomes).toEqual([true, true]);

      const afterDistinctRace = await getUserTotpSecret(db, directUser.id);
      expect(afterDistinctRace?.backupCodesHash).toEqual([directHashes[3]!]);
      expect(await consumeTotpBackupCode(db, directUser.id, directHashes[1]!)).toBe(false);
      expect(await consumeTotpBackupCode(db, directUser.id, '')).toBe(false);

      // End-to-end Admin auth BFF step-up verification via pendingToken under concurrency
      const bffSecret = generateTotpSecret();
      const bffCodes = generateBackupCodes(4);
      const bffHashes = bffCodes.map(hashBackupCode);
      await upsertUserTotpSecret(db, {
        userId: bffUser.id,
        encryptedSecret: encryptTotpSecret(bffSecret, authEnv['TOTP_ENCRYPTION_KEY']),
        backupCodesHash: bffHashes,
        enabled: true,
      });

      const loginRes = await dispatchAuthAction(
        {
          method: 'POST',
          action: 'password/login',
          clientIp,
          body: { handle, password: 'bff-race-pass' },
        },
        { db, env: authEnv },
      );
      expect(loginRes.status).toBe(200);
      expect(loginRes.body['requiresTotp']).toBe(true);
      const pendingToken = String(loginRes.body['pendingToken']);

      const parallelSameCodeResponses = await Promise.all(
        Array.from({ length: 5 }, () =>
          handleAdminAuthBffRequest(
            new Request('https://admin.andrew-k.us/api/auth/totp/verify', {
              method: 'POST',
              headers: {
                'content-type': 'application/json',
                'x-forwarded-for': clientIp,
              },
              body: JSON.stringify({ code: bffCodes[0]!, pendingToken }),
            }),
            'totp/verify',
            { db, env: authEnv },
          ),
        ),
      );
      const winners = parallelSameCodeResponses.filter(res => res.status === 200);
      const losers = parallelSameCodeResponses.filter(res => res.status === 401);
      expect(winners).toHaveLength(1);
      expect(losers).toHaveLength(4);
      expect(winners[0]?.headers.get('set-cookie')).toContain('ak_admin_session=');
      expect(await winners[0]?.json()).toMatchObject({ verified: true });
      for (const loser of losers) {
        expect(loser.headers.get('set-cookie')).toBeNull();
        expect(await loser.json()).toMatchObject({ error: 'INVALID_TOTP_CODE' });
      }

      const parallelDistinctResponses = await Promise.all(
        [bffCodes[1]!, bffCodes[2]!].map(distinctCode =>
          handleAdminAuthBffRequest(
            new Request('https://admin.andrew-k.us/api/auth/totp/verify', {
              method: 'POST',
              headers: {
                'content-type': 'application/json',
                'x-forwarded-for': clientIp,
              },
              body: JSON.stringify({ code: distinctCode, pendingToken }),
            }),
            'totp/verify',
            { db, env: authEnv },
          ),
        ),
      );
      expect(parallelDistinctResponses.map(res => res.status)).toEqual([200, 200]);
      for (const okRes of parallelDistinctResponses) {
        expect(okRes.headers.get('set-cookie')).toContain('ak_admin_session=');
      }

      const afterBffRace = await getUserTotpSecret(db, bffUser.id);
      expect(afterBffRace?.backupCodesHash).toEqual([bffHashes[3]!]);

      // Consumed codes stay rejected sequentially, while standard 6-digit TOTP still succeeds
      const replayRes = await handleAdminAuthBffRequest(
        new Request('https://admin.andrew-k.us/api/auth/totp/verify', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-forwarded-for': clientIp },
          body: JSON.stringify({ code: bffCodes[1]!, pendingToken }),
        }),
        'totp/verify',
        { db, env: authEnv },
      );
      expect(replayRes.status).toBe(401);
      expect(replayRes.headers.get('set-cookie')).toBeNull();
      expect(await replayRes.json()).toMatchObject({ error: 'INVALID_TOTP_CODE' });

      const totpRes = await handleAdminAuthBffRequest(
        new Request('https://admin.andrew-k.us/api/auth/totp/verify', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-forwarded-for': clientIp },
          body: JSON.stringify({ code: computeTotpCode(bffSecret), pendingToken }),
        }),
        'totp/verify',
        { db, env: authEnv },
      );
      expect(totpRes.status).toBe(200);
      expect(totpRes.headers.get('set-cookie')).toContain('ak_admin_session=');

      const finalSecretRow = await getUserTotpSecret(db, bffUser.id);
      expect(finalSecretRow?.backupCodesHash).toEqual([bffHashes[3]!]);
    } finally {
      await db.delete(users).where(eq(users.id, directUser.id));
      await db.delete(users).where(eq(users.id, bffUser.id));
      await resetRateLimitBucket(db, `auth:login:ip:${ipHash}`);
      await resetRateLimitBucket(db, `auth:login:handle:${handle}`);
      await resetRateLimitBucket(db, `auth:totp:ip:${ipHash}`);
      await resetRateLimitBucket(db, `auth:totp:user:${bffUser.id}`);
    }
  });

  it('applies, rolls back, and reapplies reversible 0009 migration while preserving custom CMS edits and legacy maintenance rows', async () => {
    const drizzleDir = resolve(import.meta.dirname, '../drizzle');
    const journalPath = resolve(drizzleDir, 'meta/_journal.json');
    const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as {
      entries: Array<{ idx: number; tag: string }>;
    };

    expect(
      journal.entries.some(e => e.idx === 9 && e.tag === '0009_retire_changes_in_progress_links'),
    ).toBe(true);
    expect(
      journal.entries.some(e => e.idx === 10 && e.tag === '0010_visitor_analytics_enrichment'),
    ).toBe(true);
    expect(readdirSync(drizzleDir)).toContain('0010_visitor_analytics_enrichment.sql');
    expect(
      readFileSync(resolve(drizzleDir, '0010_visitor_analytics_enrichment.sql'), 'utf8'),
    ).not.toMatch(/\broadmap_milestones\b/i);

    const upPath = resolve(drizzleDir, '0009_retire_changes_in_progress_links.sql');
    const downPath = resolve(drizzleDir, '0009_retire_changes_in_progress_links.down.sql');
    expect(existsSync(upPath)).toBe(true);
    expect(existsSync(downPath)).toBe(true);
    const up0009 = readFileSync(upPath, 'utf8');
    const down0009 = readFileSync(downPath, 'utf8');

    const snapshotHomeContent = await pool.query<{ metadata_json: Record<string, unknown> }>(
      `SELECT metadata_json FROM site_content WHERE key = 'portal-home'`,
    );
    const snapshotChromeContent = await pool.query<{ metadata_json: Record<string, unknown> }>(
      `SELECT metadata_json FROM site_content WHERE key = 'portal-chrome'`,
    );
    const snapshotDirEntries = await pool.query<{
      name: string;
      description: string;
      sort_order: number;
      enabled: boolean;
    }>(
      `SELECT name, description, sort_order, enabled
       FROM terminal_directory_entries
       WHERE profile_slug = 'portal-home'
       ORDER BY sort_order, id`,
    );
    const snapshotCommands = await pool.query<{
      name: string;
      description: string;
      allowed_routes: string[];
      error_template: string | null;
      output: string;
    }>(
      `SELECT name, description, allowed_routes, error_template, output
       FROM terminal_commands
       WHERE profile_slug = 'portal-home' AND name IN ('cd', 'help', 'ls')`,
    );
    const snapshotInitialLs = await pool.query<{ id: number; output: string }>(
      `SELECT id, output
       FROM terminal_initial_entries
       WHERE profile_slug = 'portal-home' AND command = 'ls'`,
    );

    const originalHomeMeta = snapshotHomeContent.rows[0]?.metadata_json;
    const originalChromeMeta = snapshotChromeContent.rows[0]?.metadata_json;
    expect(originalHomeMeta).toBeDefined();
    expect(originalChromeMeta).toBeDefined();

    const hadMaintenanceContent =
      (await pool.query(`SELECT 1 FROM site_content WHERE key = 'portal-maintenance'`)).rows
        .length > 0;
    const hadMaintenanceProfile =
      (await pool.query(`SELECT 1 FROM terminal_profiles WHERE slug = 'portal-maintenance'`)).rows
        .length > 0;
    const hadRoadmapRows =
      (await pool.query(`SELECT 1 FROM roadmap_milestones LIMIT 1`)).rows.length > 0;
    const sentinelMilestoneSlug = 'sentinel-legacy-compat-check';

    try {
      // Ensure pre-migration baseline rows exist even if seeds later remove changes-in-progress.
      await pool.query(down0009);

      if (!hadMaintenanceContent) {
        await pool.query(
          `INSERT INTO site_content (key, markdown_body, metadata_json)
           VALUES ('portal-maintenance', 'Legacy maintenance sentinel', '{"heading":"Maintenance"}'::jsonb)
           ON CONFLICT (key) DO NOTHING`,
        );
      }
      if (!hadMaintenanceProfile) {
        await pool.query(
          `INSERT INTO terminal_profiles (
             slug, banner_title, banner_meta, os_label, directory, vcs_branch,
             vcs_state, context_label, placeholder, quick_commands
           ) VALUES (
             'portal-maintenance', 'Maintenance', 'meta', '⚡', '~/site', 'main',
             'clean', 'visitor@andrew-k.us', 'help', ARRAY['help']
           ) ON CONFLICT (slug) DO NOTHING`,
        );
      }
      if (!hadRoadmapRows) {
        await pool.query(
          `INSERT INTO roadmap_milestones (slug, status, label, sort_order, enabled)
           VALUES ($1, 'active', 'Legacy milestone sentinel', 99, true)
           ON CONFLICT (slug) DO NOTHING`,
          [sentinelMilestoneSlug],
        );
      }
      await pool.query(
        `UPDATE site_content
         SET metadata_json = jsonb_set(metadata_json, '{maintenanceModeDefault}', 'false'::jsonb, true)
         WHERE key = 'portal-chrome'`,
      );

      // Inject custom operator heading on portal-home to verify surgical JSONB preservation.
      const customHeading = 'Custom Operator Portfolio Heading';
      await pool.query(
        `UPDATE site_content
         SET metadata_json = jsonb_set(metadata_json, '{heading}', to_jsonb($1::text), true)
         WHERE key = 'portal-home'`,
        [customHeading],
      );

      // 1. Apply 0009 forward twice (verifies both forward transformation and idempotency).
      await pool.query(up0009);
      await pool.query(up0009);

      const dirAfterUp = await pool.query<{ name: string }>(
        `SELECT name FROM terminal_directory_entries
         WHERE profile_slug = 'portal-home'
         ORDER BY sort_order, id`,
      );
      expect(dirAfterUp.rows.map(r => r.name)).not.toContain('changes-in-progress');
      expect(dirAfterUp.rows.map(r => r.name)).toEqual([
        'about',
        'tui',
        'cadence',
        'chat',
        'agensi',
        'contact',
      ]);

      const homeAfterUp = await pool.query<{
        heading: string;
        actions: Array<{ to: string; label: string; variant: string }>;
      }>(
        `SELECT
           metadata_json->>'heading' AS heading,
           metadata_json->'actions' AS actions
         FROM site_content
         WHERE key = 'portal-home'`,
      );
      expect(homeAfterUp.rows[0]?.heading).toBe(customHeading);
      expect(homeAfterUp.rows[0]?.actions.map(a => a.to)).toEqual([
        '/about',
        '/cadence',
        '/chat',
        '/agensi',
        '/contact',
      ]);

      const cmdsAfterUp = await pool.query<{
        name: string;
        description: string;
        allowed_routes: string[];
        error_template: string | null;
        output: string;
      }>(
        `SELECT name, description, allowed_routes, error_template, output
         FROM terminal_commands
         WHERE profile_slug = 'portal-home' AND name IN ('cd', 'help', 'ls')`,
      );
      const cdAfterUp = cmdsAfterUp.rows.find(r => r.name === 'cd');
      const helpAfterUp = cmdsAfterUp.rows.find(r => r.name === 'help');
      const lsCmdAfterUp = cmdsAfterUp.rows.find(r => r.name === 'ls');
      expect(cdAfterUp?.allowed_routes).toEqual(['about', 'cadence', 'chat', 'agensi', 'contact']);
      expect(cdAfterUp?.description).toContain(', or /contact');
      expect(cdAfterUp?.description).not.toContain('changes-in-progress');
      expect(cdAfterUp?.error_template).not.toContain('changes-in-progress');
      expect(cdAfterUp?.error_template).toMatch(/cd contact$/);
      expect(helpAfterUp?.output).toContain(', or /contact');
      expect(helpAfterUp?.output).not.toContain('changes-in-progress');
      expect(lsCmdAfterUp?.output).not.toContain('changes-in-progress');
      expect(lsCmdAfterUp?.output).toContain('contact');
      expect(lsCmdAfterUp?.output.endsWith('\n')).toBe(false);

      const initialLsAfterUp = await pool.query<{ output: string }>(
        `SELECT output
         FROM terminal_initial_entries
         WHERE profile_slug = 'portal-home' AND command = 'ls'`,
      );
      expect(initialLsAfterUp.rows[0]?.output).not.toContain('changes-in-progress');
      expect(initialLsAfterUp.rows[0]?.output).toContain('contact');
      expect(initialLsAfterUp.rows[0]?.output.endsWith('\n')).toBe(false);

      // Verify legacy maintenance tables/rows remain intact for concurrent prior revisions.
      const roadmapCount = await pool.query<{ cnt: number }>(
        `SELECT COUNT(*)::int AS cnt FROM roadmap_milestones`,
      );
      expect(Number(roadmapCount.rows[0]?.cnt)).toBeGreaterThanOrEqual(1);
      const maintenanceSite = await pool.query(
        `SELECT key FROM site_content WHERE key = 'portal-maintenance'`,
      );
      expect(maintenanceSite.rows).toHaveLength(1);
      const maintenanceProfile = await pool.query(
        `SELECT slug FROM terminal_profiles WHERE slug = 'portal-maintenance'`,
      );
      expect(maintenanceProfile.rows).toHaveLength(1);
      const chromeLegacyFlag = await pool.query<{ has_flag: boolean }>(
        `SELECT (metadata_json ? 'maintenanceModeDefault') AS has_flag
         FROM site_content
         WHERE key = 'portal-chrome'`,
      );
      expect(chromeLegacyFlag.rows[0]?.has_flag).toBe(true);

      // Verify actions.min(1) guard refuses to empty an actions array containing only /changes-in-progress.
      const savedPostUpActions = homeAfterUp.rows[0]?.actions ?? [];
      await pool.query(
        `UPDATE site_content
         SET metadata_json = jsonb_set(
           metadata_json,
           '{actions}',
           '[{"label":"Maintenance Preview → /changes-in-progress","to":"/changes-in-progress","variant":"default"}]'::jsonb,
           false
         )
         WHERE key = 'portal-home'`,
      );
      await pool.query(up0009);
      const guardedActions = await pool.query<{ actions: Array<{ to: string }> }>(
        `SELECT metadata_json->'actions' AS actions FROM site_content WHERE key = 'portal-home'`,
      );
      expect(guardedActions.rows[0]?.actions).toHaveLength(1);
      expect(guardedActions.rows[0]?.actions[0]?.to).toBe('/changes-in-progress');
      await pool.query(
        `UPDATE site_content
         SET metadata_json = jsonb_set(metadata_json, '{actions}', $1::jsonb, false)
         WHERE key = 'portal-home'`,
        [JSON.stringify(savedPostUpActions)],
      );

      // Simulate a Stage 1 CMS save stripping maintenanceModeDefault before rolling back to N-1.
      const chromeBeforeStrip = await pool.query<{
        markdown_body: string;
        metadata_json: Record<string, unknown>;
      }>(`SELECT markdown_body, metadata_json FROM site_content WHERE key = 'portal-chrome'`);
      const strippedChrome = await upsertSiteContent(
        db,
        SITE_CONTENT_KEYS.portalChrome,
        chromeBeforeStrip.rows[0]?.markdown_body ?? 'Portal chrome',
        chromeBeforeStrip.rows[0]?.metadata_json ?? {},
      );
      expect('maintenanceModeDefault' in strippedChrome.metadataJson).toBe(false);

      // 2. Roll back 0009 twice (verifies complete reversibility, N-1 portal-chrome backfill, and idempotency).
      await pool.query(down0009);
      await pool.query(down0009);

      const chromeAfterDown = await pool.query<{
        metadata_json: Record<string, unknown>;
      }>(`SELECT metadata_json FROM site_content WHERE key = 'portal-chrome'`);
      expect(chromeAfterDown.rows[0]?.metadata_json['maintenanceModeDefault']).toBe(false);
      expect(chromeAfterDown.rows[0]?.metadata_json['brandLabel']).toBe(
        strippedChrome.metadataJson['brandLabel'],
      );

      const dirAfterDown = await pool.query<{ name: string }>(
        `SELECT name FROM terminal_directory_entries
         WHERE profile_slug = 'portal-home' AND name = 'changes-in-progress'`,
      );
      expect(dirAfterDown.rows).toHaveLength(1);

      const homeAfterDown = await pool.query<{
        heading: string;
        actions: Array<{ to: string }>;
      }>(
        `SELECT
           metadata_json->>'heading' AS heading,
           metadata_json->'actions' AS actions
         FROM site_content
         WHERE key = 'portal-home'`,
      );
      expect(homeAfterDown.rows[0]?.heading).toBe(customHeading);
      expect(homeAfterDown.rows[0]?.actions.map(a => a.to)).toEqual([
        '/about',
        '/cadence',
        '/chat',
        '/agensi',
        '/contact',
        '/changes-in-progress',
      ]);

      const cmdsAfterDown = await pool.query<{
        name: string;
        description: string;
        allowed_routes: string[];
        error_template: string | null;
        output: string;
      }>(
        `SELECT name, description, allowed_routes, error_template, output
         FROM terminal_commands
         WHERE profile_slug = 'portal-home' AND name IN ('cd', 'help', 'ls')`,
      );
      const cdAfterDown = cmdsAfterDown.rows.find(r => r.name === 'cd');
      const helpAfterDown = cmdsAfterDown.rows.find(r => r.name === 'help');
      const lsCmdAfterDown = cmdsAfterDown.rows.find(r => r.name === 'ls');
      expect(cdAfterDown?.allowed_routes).toEqual([
        'about',
        'cadence',
        'chat',
        'agensi',
        'contact',
        'changes-in-progress',
      ]);
      expect(cdAfterDown?.description).toContain(', /contact, or /changes-in-progress');
      expect(cdAfterDown?.error_template).toContain(' | cd changes-in-progress');
      expect(helpAfterDown?.output).toContain(', /contact, or /changes-in-progress');
      expect(lsCmdAfterDown?.output.match(/changes-in-progress/g)).toHaveLength(1);

      const initialLsAfterDown = await pool.query<{ output: string }>(
        `SELECT output
         FROM terminal_initial_entries
         WHERE profile_slug = 'portal-home' AND command = 'ls'`,
      );
      expect(initialLsAfterDown.rows[0]?.output.match(/changes-in-progress/g)).toHaveLength(1);

      // 3. Reapply 0009 forward and verify clean retirement persists.
      await pool.query(up0009);

      const dirAfterReapply = await pool.query<{ name: string }>(
        `SELECT name FROM terminal_directory_entries
         WHERE profile_slug = 'portal-home' AND name = 'changes-in-progress'`,
      );
      expect(dirAfterReapply.rows).toHaveLength(0);

      const homeAfterReapply = await pool.query<{
        heading: string;
        actions: Array<{ to: string }>;
      }>(
        `SELECT
           metadata_json->>'heading' AS heading,
           metadata_json->'actions' AS actions
         FROM site_content
         WHERE key = 'portal-home'`,
      );
      expect(homeAfterReapply.rows[0]?.heading).toBe(customHeading);
      expect(homeAfterReapply.rows[0]?.actions.map(a => a.to)).toEqual([
        '/about',
        '/cadence',
        '/chat',
        '/agensi',
        '/contact',
      ]);
    } finally {
      await pool.query(
        `UPDATE site_content SET metadata_json = $1::jsonb WHERE key = 'portal-home'`,
        [JSON.stringify(originalHomeMeta)],
      );
      await pool.query(
        `UPDATE site_content SET metadata_json = $1::jsonb WHERE key = 'portal-chrome'`,
        [JSON.stringify(originalChromeMeta)],
      );
      await pool.query(`DELETE FROM terminal_directory_entries WHERE profile_slug = 'portal-home'`);
      for (const entry of snapshotDirEntries.rows) {
        await pool.query(
          `INSERT INTO terminal_directory_entries (profile_slug, name, description, sort_order, enabled)
           VALUES ('portal-home', $1, $2, $3, $4)`,
          [entry.name, entry.description, entry.sort_order, entry.enabled],
        );
      }
      for (const cmd of snapshotCommands.rows) {
        await pool.query(
          `UPDATE terminal_commands
           SET description = $1, allowed_routes = $2, error_template = $3, output = $4
           WHERE profile_slug = 'portal-home' AND name = $5`,
          [cmd.description, cmd.allowed_routes, cmd.error_template, cmd.output, cmd.name],
        );
      }
      for (const entry of snapshotInitialLs.rows) {
        await pool.query(`UPDATE terminal_initial_entries SET output = $1 WHERE id = $2`, [
          entry.output,
          entry.id,
        ]);
      }
      if (!hadMaintenanceContent) {
        await pool.query(`DELETE FROM site_content WHERE key = 'portal-maintenance'`);
      }
      if (!hadMaintenanceProfile) {
        await pool.query(`DELETE FROM terminal_profiles WHERE slug = 'portal-maintenance'`);
      }
      if (!hadRoadmapRows) {
        await pool.query(`DELETE FROM roadmap_milestones WHERE slug = $1`, [sentinelMilestoneSlug]);
      }
    }
  });

  it('tolerates dormant portal-maintenance rows and kind=roadmap commands, strips retired keys on registered site_content saves, and prunes retired rows on upsert seed', async () => {
    const originalChrome = await pool.query<{
      markdown_body: string;
      metadata_json: Record<string, unknown>;
    }>(`SELECT markdown_body, metadata_json FROM site_content WHERE key = 'portal-chrome'`);
    const originalHome = await pool.query<{
      markdown_body: string;
      metadata_json: Record<string, unknown>;
    }>(`SELECT markdown_body, metadata_json FROM site_content WHERE key = 'portal-home'`);

    try {
      // Seed dormant legacy rows simulating an in-flight rollout database.
      await pool.query(
        `UPDATE site_content
         SET metadata_json = jsonb_set(metadata_json, '{maintenanceModeDefault}', 'true'::jsonb, true)
         WHERE key = 'portal-chrome'`,
      );
      await pool.query(
        `INSERT INTO site_content (key, markdown_body, metadata_json)
         VALUES ('portal-maintenance', 'Legacy maintenance copy', '{"heading":"Maintenance"}'::jsonb)
         ON CONFLICT (key) DO NOTHING`,
      );
      await pool.query(
        `INSERT INTO terminal_profiles (
           slug, banner_title, banner_meta, os_label, directory, vcs_branch,
           vcs_state, context_label, placeholder, quick_commands
         ) VALUES (
           'portal-maintenance', 'Maintenance', 'meta', '⚡', '~/site', 'main',
           'clean', 'visitor@andrew-k.us', 'help', ARRAY['help']
         ) ON CONFLICT (slug) DO NOTHING`,
      );
      await pool.query(
        `INSERT INTO terminal_commands (
           profile_slug, name, description, kind, output, target_route,
           allowed_routes, error_template, sort_order
         ) VALUES (
           'portal-maintenance', 'roadmap', 'legacy roadmap', 'roadmap', '', NULL,
           ARRAY[]::text[], NULL, 1
         ) ON CONFLICT (profile_slug, name) DO NOTHING`,
      );
      await pool.query(
        `INSERT INTO terminal_directory_entries (profile_slug, name, description, sort_order, enabled)
         VALUES ('portal-home', 'changes-in-progress', 'Maintenance preview', 6, true)
         ON CONFLICT (profile_slug, name) DO NOTHING`,
      );

      // Portal root loader succeeds against legacy portal-chrome JSONB with no maintenance properties.
      const portalRoot = await loadPortalRootData(db);
      expect('maintenanceMode' in portalRoot).toBe(false);
      expect('maintenance' in portalRoot).toBe(false);
      expect('maintenanceModeDefault' in portalRoot.chrome).toBe(false);

      // Admin overview succeeds without maintenance fields.
      const overview = await loadAdminOverviewData(db);
      expect('maintenanceModeDefault' in overview).toBe(false);
      expect('rebuildProgressPercent' in overview).toBe(false);

      // Admin CMS loads cleanly without ZodError and filters dormant portal-maintenance rows out of display lists.
      const cms = await loadAdminCmsData(db);
      expect(cms.siteContents.some(row => row.key === 'portal-maintenance')).toBe(false);
      expect(cms.terminalProfiles.some(row => row.slug === 'portal-maintenance')).toBe(false);
      expect(cms.terminalCommands.some(row => row.profileSlug === 'portal-maintenance')).toBe(
        false,
      );
      expect('roadmapMilestones' in cms).toBe(false);

      // Saving a registered site_content row strips retired/unknown keys (such as maintenanceModeDefault).
      const chromeBody = originalChrome.rows[0]?.markdown_body ?? 'Portal chrome';
      const chromeMeta = originalChrome.rows[0]?.metadata_json ?? {};
      const savedChrome = await upsertSiteContent(db, SITE_CONTENT_KEYS.portalChrome, chromeBody, {
        ...chromeMeta,
        maintenanceModeDefault: true,
        unexpectedLegacyField: 'remove-me',
      });
      expect('maintenanceModeDefault' in savedChrome.metadataJson).toBe(false);
      expect('unexpectedLegacyField' in savedChrome.metadataJson).toBe(false);

      // Bootstrap seed mode is non-destructive and preserves legacy rows.
      await seedDatabase(db, { mode: 'bootstrap', env: { ADMIN_PASSWORD: '' } });
      const bootstrapMaint = await pool.query(
        `SELECT key FROM site_content WHERE key = 'portal-maintenance'`,
      );
      expect(bootstrapMaint.rows).toHaveLength(1);
      const bootstrapDir = await pool.query(
        `SELECT name FROM terminal_directory_entries
         WHERE profile_slug = 'portal-home' AND name = 'changes-in-progress'`,
      );
      expect(bootstrapDir.rows).toHaveLength(1);

      // Upsert seed mode prunes retired portal-maintenance and changes-in-progress rows cleanly.
      await seedDatabase(db, { mode: 'upsert', env: { ADMIN_PASSWORD: '' } });
      const upsertMaintSite = await pool.query(
        `SELECT key FROM site_content WHERE key = 'portal-maintenance'`,
      );
      expect(upsertMaintSite.rows).toHaveLength(0);
      const upsertMaintProfile = await pool.query(
        `SELECT slug FROM terminal_profiles WHERE slug = 'portal-maintenance'`,
      );
      expect(upsertMaintProfile.rows).toHaveLength(0);
      const upsertDir = await pool.query(
        `SELECT name FROM terminal_directory_entries
         WHERE profile_slug = 'portal-home' AND name = 'changes-in-progress'`,
      );
      expect(upsertDir.rows).toHaveLength(0);
    } finally {
      if (originalChrome.rows[0]) {
        await pool.query(
          `UPDATE site_content SET markdown_body = $1, metadata_json = $2::jsonb WHERE key = 'portal-chrome'`,
          [
            originalChrome.rows[0].markdown_body,
            JSON.stringify(originalChrome.rows[0].metadata_json),
          ],
        );
      }
      if (originalHome.rows[0]) {
        await pool.query(
          `UPDATE site_content SET markdown_body = $1, metadata_json = $2::jsonb WHERE key = 'portal-home'`,
          [originalHome.rows[0].markdown_body, JSON.stringify(originalHome.rows[0].metadata_json)],
        );
      }
      await pool.query(`DELETE FROM site_content WHERE key = 'portal-maintenance'`);
      await pool.query(`DELETE FROM terminal_profiles WHERE slug = 'portal-maintenance'`);
      await pool.query(
        `DELETE FROM terminal_directory_entries
         WHERE profile_slug = 'portal-home' AND name = 'changes-in-progress'`,
      );
    }
  });

  it('hydrates legacy 5-field portal-home rows on bootstrap, persists portrait/resume on upsert, and guards portal-home upserts against invalid portrait.src and PII/References', async () => {
    const originalHome = await pool.query<{
      markdown_body: string;
      metadata_json: Record<string, unknown>;
    }>(`SELECT markdown_body, metadata_json FROM site_content WHERE key = 'portal-home'`);

    const prevDenylist = process.env['DOSSIER_PRIVACY_DENYLIST'];
    const encodedDenylist = Buffer.from(
      JSON.stringify(['SyntheticConfidentialClientX']),
      'utf8',
    ).toString('base64');
    process.env['DOSSIER_PRIVACY_DENYLIST'] = encodedDenylist;

    const warnLogs: string[] = [];
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation((msg: unknown) => {
      warnLogs.push(String(msg));
    });

    const legacyFiveFieldHome = {
      tuiTitle: 'Legacy Launcher',
      tuiBadge: { source: 'cloud-run', state: 'idle', label: 'Idle' },
      heading: 'Legacy Heading',
      description: 'Legacy 5-field portal-home row.',
      actions: [{ label: 'Contact', to: '/contact', variant: 'primary' }],
    };

    try {
      // Seed a legacy 5-field row directly in PG19 and run bootstrap mode (must preserve row, hydrate via Zod defaults)
      await pool.query(
        `UPDATE site_content SET markdown_body = $1, metadata_json = $2::jsonb WHERE key = 'portal-home'`,
        ['# Legacy body', JSON.stringify(legacyFiveFieldHome)],
      );
      await seedDatabase(db, { mode: 'bootstrap', env: { ADMIN_PASSWORD: '' } });

      const rawAfterBootstrap = await pool.query<{ metadata_json: Record<string, unknown> }>(
        `SELECT metadata_json FROM site_content WHERE key = 'portal-home'`,
      );
      expect(rawAfterBootstrap.rows[0]?.metadata_json['heading']).toBe('Legacy Heading');
      expect('portrait' in (rawAfterBootstrap.rows[0]?.metadata_json ?? {})).toBe(false);

      const hydratedHome = await loadPortalHomeData(db);
      expect(hydratedHome.content.heading).toBe('Legacy Heading');
      expect(hydratedHome.content.portrait.src).toBe('/images/andrew-klapper-portrait.webp');
      expect(hydratedHome.content.resumeSummary.publicEmail).toBe('andrew@andrew-k.us');

      // Upsert mode persists canonical portrait & resumeSummary into PostgreSQL JSONB
      await seedDatabase(db, { mode: 'upsert', env: { ADMIN_PASSWORD: '' } });
      const rawAfterUpsert = await pool.query<{ metadata_json: Record<string, unknown> }>(
        `SELECT metadata_json FROM site_content WHERE key = 'portal-home'`,
      );
      expect(rawAfterUpsert.rows[0]?.metadata_json['portrait']).toBeDefined();
      expect(rawAfterUpsert.rows[0]?.metadata_json['resumeSummary']).toBeDefined();

      const seededHome = await loadPortalHomeData(db);
      const validMeta = seededHome.content;

      // Reject non-root-relative portrait.src and emit UNSOUND_CONDITION seam without raw URI
      warnLogs.length = 0;
      const hostilePortraitUri = 'https://evil.example.invalid/hotlink-portrait.webp';
      await expect(
        upsertSiteContent(db, SITE_CONTENT_KEYS.portalHome, '# Home', {
          ...validMeta,
          portrait: { ...validMeta.portrait, src: hostilePortraitUri },
        }),
      ).rejects.toThrow(/root-relative/i);
      const portraitWarnBlob = warnLogs.join('\n');
      expect(portraitWarnBlob).toContain('portal.home.portrait_src_invalid');
      expect(portraitWarnBlob).toContain('UNSOUND_CONDITION');
      expect(portraitWarnBlob).not.toContain(hostilePortraitUri);

      // Reject PII / References / denylist in portal-home write without mutating PostgreSQL
      await expect(
        upsertSiteContent(db, SITE_CONTENT_KEYS.portalHome, '# Home', {
          ...validMeta,
          resumeSummary: {
            ...validMeta.resumeSummary,
            bio: 'Call (555) 010-1234 or email reference.contact@example.com in Marietta, GA 99999.',
          },
        }),
      ).rejects.toBeInstanceOf(PrivacySanitizationError);

      await expect(
        upsertSiteContent(db, SITE_CONTENT_KEYS.portalHome, '## References\nJane Synthetic', {
          ...validMeta,
        }),
      ).rejects.toBeInstanceOf(PrivacySanitizationError);

      // Clean portal-home upsert containing allow-listed andrew@andrew-k.us succeeds and persists
      const updatedBio =
        'Updated clean bio with andrew@andrew-k.us verified across Go, TypeScript, and PostgreSQL 19.';
      const saved = await upsertSiteContent(db, SITE_CONTENT_KEYS.portalHome, '# Home clean', {
        ...validMeta,
        resumeSummary: {
          ...validMeta.resumeSummary,
          bio: updatedBio,
        },
      });
      expect((saved.metadataJson['resumeSummary'] as Record<string, unknown>)['bio']).toBe(
        updatedBio,
      );
    } finally {
      warnSpy.mockRestore();
      if (prevDenylist === undefined) delete process.env['DOSSIER_PRIVACY_DENYLIST'];
      else process.env['DOSSIER_PRIVACY_DENYLIST'] = prevDenylist;

      if (originalHome.rows[0]) {
        await pool.query(
          `UPDATE site_content SET markdown_body = $1, metadata_json = $2::jsonb WHERE key = 'portal-home'`,
          [originalHome.rows[0].markdown_body, JSON.stringify(originalHome.rows[0].metadata_json)],
        );
      }
    }
  });

  it('seeds 10 sanitized resume dossiers atomically, upgrades pre-existing PG19 databases safely, and enforces pre-write + upsertSiteContent privacy boundaries', async () => {
    const prodDenylist = JSON.stringify(['SyntheticConfidentialClientX']);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    const readAboutSourceBranchEvents = () =>
      infoSpy.mock.calls
        .map(call => {
          try {
            return JSON.parse(String(call[0])) as Record<string, unknown>;
          } catch {
            return null;
          }
        })
        .filter(
          (entry): entry is Record<string, unknown> =>
            entry !== null && entry['event'] === 'portal.about.loader_source_branch',
        );

    try {
      // 1. Fresh/live loadPortalAboutData returns portal-about, 10 published dossiers, and emits postgres_live branch seam
      await seedDatabase(db, {
        mode: 'upsert',
        env: {
          ADMIN_PASSWORD: '',
          NODE_ENV: 'production',
          DOSSIER_PRIVACY_DENYLIST: prodDenylist,
        },
      });
      infoSpy.mockClear();
      const liveAbout = await loadPortalAboutData(db);
      expect(liveAbout.content.identity.fullName).toBe('Andrew Klapper');
      expect(liveAbout.content.skillGroups).toHaveLength(5);
      expect(liveAbout.dossiers).toHaveLength(10);
      expect(liveAbout.brandContactEmail).toBe('andrew@andrew-k.us');
      expect(readAboutSourceBranchEvents()).toEqual([
        expect.objectContaining({
          event: 'portal.about.loader_source_branch',
          seamType: 'RULE_DIVERGENCE',
          branch: 'postgres_live',
          dossierCount: 10,
        }),
      ]);

      // 2. Prerender fallback resolves without DATABASE_URL when prerender flag is active
      const prevPrerender = process.env['IS_RR_BUILD_REQUEST'];
      const prevDbUrl = process.env['DATABASE_URL'];
      try {
        process.env['IS_RR_BUILD_REQUEST'] = 'yes';
        delete process.env['DATABASE_URL'];
        const prerendered = await loadPortalAboutDataWithPrerender();
        expect(prerendered.content.identity.location).toBe('Marietta, GA');
        expect(prerendered.dossiers).toHaveLength(10);
        expect(prerendered.brandContactEmail).toBe('andrew@andrew-k.us');
      } finally {
        if (prevPrerender === undefined) delete process.env['IS_RR_BUILD_REQUEST'];
        else process.env['IS_RR_BUILD_REQUEST'] = prevPrerender;
        if (prevDbUrl !== undefined) process.env['DATABASE_URL'] = prevDbUrl;
      }

      // 3. Production seedDatabase fails closed before mutating PG19 when DOSSIER_PRIVACY_DENYLIST is unset
      await expect(
        seedDatabase(db, {
          mode: 'upsert',
          env: {
            ADMIN_PASSWORD: '',
            NODE_ENV: 'production',
            DOSSIER_PRIVACY_DENYLIST: '',
          },
        }),
      ).rejects.toMatchObject({
        status: 422,
        findings: expect.arrayContaining([
          expect.objectContaining({ ruleId: 'config.denylist_empty_in_prod' }),
        ]),
      });

      // 4. Pre-write sanitization aborts BEFORE writing any site_content or career_dossiers row
      await expect(
        seedDatabase(db, {
          mode: 'upsert',
          env: { ADMIN_PASSWORD: '', DOSSIER_PRIVACY_DENYLIST: prodDenylist },
          siteContentSeeds: [
            {
              key: SITE_CONTENT_KEYS.portalAbout,
              markdownBody: 'Clean',
              metadataJson: {
                ...liveAbout.content,
                description: 'Synthetic phone (555) 010-1234 should abort pre-write',
              },
            },
          ],
        }),
      ).rejects.toMatchObject({ status: 422 });
      const untouchedAbout = await loadPortalAboutData(db);
      expect(untouchedAbout.content.description).not.toContain('555');

      // 4b. Poisoned mid-batch careerDossierSeeds aborts pre-write before mutating even clean earlier batch entries
      const cleanFirstSeed = CAREER_DOSSIER_SEEDS[0];
      const secondSeed = CAREER_DOSSIER_SEEDS[1];
      if (!cleanFirstSeed || !secondSeed) {
        throw new Error('Expected at least 2 seeded career dossiers');
      }
      await expect(
        seedDatabase(db, {
          mode: 'upsert',
          env: { ADMIN_PASSWORD: '', DOSSIER_PRIVACY_DENYLIST: prodDenylist },
          careerDossierSeeds: [
            {
              ...cleanFirstSeed,
              title: 'Should Never Commit Before Poisoned Entry',
            },
            {
              ...secondSeed,
              summaryBody:
                'Poisoned mid-batch dossier for SyntheticConfidentialClientX at (555) 010-1234.',
            },
          ],
        }),
      ).rejects.toMatchObject({ status: 422 });
      const untouchedFirst = await getCareerDossierBySlug(db, cleanFirstSeed.slug);
      expect(untouchedFirst?.title).toBe(cleanFirstSeed.title);

      // 5. Existing-database upgrade path: simulate pre-upgrade DB missing portal-about & stale profile_core
      await pool.query(`DELETE FROM site_content WHERE key = 'portal-about'`);
      await pool.query(
        `UPDATE career_dossiers SET role_title = 'Stale Legacy Role', skills = ARRAY['Legacy']
         WHERE slug = 'andrew-klapper-profile-core'`,
      );
      await pool.query(
        `DELETE FROM terminal_commands WHERE profile_slug = 'portal-home' AND name = 'about'`,
      );

      // Upsert upgrade restores portal-about, terminal about command, and full-column dossier metadata atomically
      await seedDatabase(db, {
        mode: 'upsert',
        env: {
          ADMIN_PASSWORD: '',
          NODE_ENV: 'production',
          DOSSIER_PRIVACY_DENYLIST: prodDenylist,
        },
      });
      const upgraded = await loadPortalAboutData(db);
      const profileCore = upgraded.dossiers.find(d => d.slug === 'andrew-klapper-profile-core');
      expect(profileCore?.roleTitle).toBe('Senior Full-Stack & Systems Engineer');
      expect(profileCore?.skills).toContain('C# (.NET 10)');
      const aboutCmd = await pool.query(
        `SELECT name FROM terminal_commands WHERE profile_slug = 'portal-home' AND name = 'about'`,
      );
      expect(aboutCmd.rows).toHaveLength(1);

      // Bootstrap mode preserves operator edits while backfilling missing rows
      const operatorEdited = await upsertSiteContent(
        db,
        SITE_CONTENT_KEYS.portalAbout,
        'Operator edited markdown',
        {
          ...upgraded.content,
          servicesIntro: 'Operator customized services intro.',
        },
        { rawDenylist: prodDenylist, env: { NODE_ENV: 'production' } },
      );
      expect(operatorEdited.metadataJson['servicesIntro']).toBe(
        'Operator customized services intro.',
      );
      await seedDatabase(db, {
        mode: 'bootstrap',
        env: {
          ADMIN_PASSWORD: '',
          NODE_ENV: 'production',
          DOSSIER_PRIVACY_DENYLIST: prodDenylist,
        },
      });
      const afterBootstrap = await loadPortalAboutData(db);
      expect(afterBootstrap.content.servicesIntro).toBe('Operator customized services intro.');

      // 6. upsertSiteContent rejects portal-about PII/ZIP and empty prod denylist with HTTP 422
      await expect(
        upsertSiteContent(
          db,
          SITE_CONTENT_KEYS.portalAbout,
          'Bad ZIP Marietta, GA 30062',
          upgraded.content,
          { rawDenylist: prodDenylist, env: { NODE_ENV: 'production' } },
        ),
      ).rejects.toMatchObject({ status: 422 });
      await expect(
        upsertSiteContent(db, SITE_CONTENT_KEYS.portalAbout, 'Clean', upgraded.content, {
          rawDenylist: '',
          env: { NODE_ENV: 'production' },
        }),
      ).rejects.toMatchObject({
        status: 422,
        findings: expect.arrayContaining([
          expect.objectContaining({ ruleId: 'config.denylist_empty_in_prod' }),
        ]),
      });

      // 7. Live PG19 authority: unpublishing a dossier immediately removes it from loadPortalAboutData
      await unpublishCareerDossier(db, 'woodstock-developers-group-mentor');
      const afterUnpublish = await loadPortalAboutData(db);
      expect(
        afterUnpublish.dossiers.some(d => d.slug === 'woodstock-developers-group-mentor'),
      ).toBe(false);

      // 8. All dossiers unpublished -> returns empty dossiers array and emits empty_dossiers_degraded branch seam
      await pool.query(`UPDATE career_dossiers SET publish_status = 'draft'`);
      infoSpy.mockClear();
      const emptyAbout = await loadPortalAboutData(db);
      expect(emptyAbout.dossiers).toEqual([]);
      expect(readAboutSourceBranchEvents()).toEqual([
        expect.objectContaining({
          event: 'portal.about.loader_source_branch',
          seamType: 'RULE_DIVERGENCE',
          branch: 'empty_dossiers_degraded',
          dossierCount: 0,
        }),
      ]);
    } finally {
      infoSpy.mockRestore();
      warnSpy.mockRestore();
      // Restore canonical seed state for subsequent tests
      await seedDatabase(db, {
        mode: 'upsert',
        env: {
          ADMIN_PASSWORD: '',
          NODE_ENV: 'test',
          DOSSIER_PRIVACY_DENYLIST: prodDenylist,
        },
      });
    }
  });

  it('additively merges /about navigation into pre-existing portal-home rows during bootstrap mode without overwriting operator edits', async () => {
    const prodDenylist = JSON.stringify(['SyntheticConfidentialClientX']);

    try {
      // Simulate a pre-upgrade PG19 database missing portal-about & /about navigation, with custom operator portal-home copy
      await pool.query(`DELETE FROM site_content WHERE key = 'portal-about'`);
      await pool.query(
        `DELETE FROM terminal_commands WHERE profile_slug = 'portal-home' AND name = 'about'`,
      );
      await pool.query(
        `DELETE FROM terminal_directory_entries WHERE profile_slug = 'portal-home' AND name = 'about'`,
      );
      await pool.query(
        `UPDATE terminal_commands
         SET allowed_routes = ARRAY['cadence', 'chat', 'agensi', 'contact']
         WHERE profile_slug = 'portal-home' AND name = 'cd'`,
      );
      await pool.query(
        `UPDATE terminal_profiles
         SET quick_commands = ARRAY['ls', 'tui', 'cadence', 'chat', 'agensi', 'contact', 'help', 'clear']
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
            heading: 'Custom Operator Heading',
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

      // portal-about, terminal_commands['about'], and terminal_directory_entries['about'] backfilled
      const aboutData = await loadPortalAboutData(db);
      expect(aboutData.content.identity.fullName).toBe('Andrew Klapper');

      const aboutCmd = await pool.query(
        `SELECT name FROM terminal_commands WHERE profile_slug = 'portal-home' AND name = 'about'`,
      );
      expect(aboutCmd.rows).toHaveLength(1);

      const aboutDir = await pool.query(
        `SELECT name FROM terminal_directory_entries WHERE profile_slug = 'portal-home' AND name = 'about'`,
      );
      expect(aboutDir.rows).toHaveLength(1);

      // Additive merge into existing rows: cd.allowed_routes, quick_commands, portal-home.actions
      const cdRow = await pool.query<{ allowed_routes: string[] }>(
        `SELECT allowed_routes FROM terminal_commands WHERE profile_slug = 'portal-home' AND name = 'cd'`,
      );
      expect(cdRow.rows[0]?.allowed_routes).toContain('about');

      const profileRow = await pool.query<{ quick_commands: string[] }>(
        `SELECT quick_commands FROM terminal_profiles WHERE slug = 'portal-home'`,
      );
      expect(profileRow.rows[0]?.quick_commands).toContain('about');

      const updatedHome = await pool.query<{ metadata_json: Record<string, unknown> }>(
        `SELECT metadata_json FROM site_content WHERE key = 'portal-home'`,
      );
      const updatedMeta = updatedHome.rows[0]?.metadata_json ?? {};
      expect(updatedMeta['tuiTitle']).toBe('Custom Operator Launcher Title');
      expect(updatedMeta['heading']).toBe('Custom Operator Heading');
      const updatedActions = Array.isArray(updatedMeta['actions'])
        ? (updatedMeta['actions'] as Array<Record<string, unknown>>)
        : [];
      expect(updatedActions.some(a => a['to'] === '/about')).toBe(true);
    } finally {
      await seedDatabase(db, {
        mode: 'upsert',
        env: {
          ADMIN_PASSWORD: '',
          NODE_ENV: 'test',
          DOSSIER_PRIVACY_DENYLIST: prodDenylist,
        },
      });
    }
  });

  it('applies 0010 visitor analytics enrichment from 0009 baseline, backfills legacy rows, supports rolling-deploy inserts, rolls back cleanly, and reapplies idempotently', async () => {
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

    const expectedSessionColumns = [
      'app',
      'is_bot',
      'visitor_hash',
      'guest_session_id',
      'city',
      'timezone',
      'asn',
      'asn_org',
      'referrer_host',
      'referrer_category',
      'landing_path',
      'ref_param',
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_content',
      'device_type',
      'os_name',
      'browser_name',
      'last_seen_at',
    ] as const;
    const expectedContactColumns = ['analytics_session_id', 'guest_session_id'] as const;
    const expectedIndexes = [
      'analytics_sessions_app_bot_started_idx',
      'analytics_sessions_visitor_hash_started_idx',
      'analytics_sessions_guest_session_idx',
      'analytics_sessions_referrer_host_started_idx',
      'analytics_sessions_geo_started_idx',
      'analytics_events_session_created_idx',
      'analytics_events_type_created_path_idx',
      'contact_submissions_analytics_session_idx',
      'contact_submissions_guest_session_idx',
      'ask_turns_session_created_idx',
      'ask_turns_created_at_idx',
    ] as const;

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
      // Suppress expected 57P01 errors emitted on draining sockets when DROP DATABASE WITH (FORCE) runs in finally.
      isoPool.on('error', (err: unknown) => {
        const code =
          typeof err === 'object' && err !== null && 'code' in err ? err.code : undefined;
        if (code !== '57P01') {
          throw err;
        }
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

      const getExistingIndexes = async (): Promise<string[]> => {
        const res = await isoPool!.query<{ indexname: string }>(
          `SELECT indexname FROM pg_indexes
           WHERE schemaname = 'public' AND indexname = ANY($1::text[])`,
          [expectedIndexes],
        );
        return res.rows.map(row => row.indexname);
      };

      // 1. Migrate isolated database through 0000..0009 (pre-0010 baseline).
      await runMigrations(isoDb, tempPre0010Dir);
      expect(await getTableColumns('analytics_sessions')).toHaveLength(6);
      expect(await getTableColumns('contact_submissions')).not.toContain('analytics_session_id');

      // 2. Insert realistic pre-0010 legacy rows (portal session, admin session, contact submission, ask turn, roadmap milestone).
      await isoPool.query(
        `INSERT INTO analytics_sessions (session_id, ip_hash, referrer, country, region, started_at)
         VALUES
           ('legacy-portal-sess', 'portal-ip-hash', 'https://example.com', 'US', 'GA', '2026-11-20T12:00:00Z'),
           ('legacy-admin-sess', 'admin-ip-hash', NULL, 'US', 'GA', '2026-11-20T12:05:00Z')`,
      );
      await isoPool.query(
        `INSERT INTO analytics_events (session_id, type, name, path, metadata_json)
         VALUES
           ('legacy-portal-sess', 'page_view', 'page_view', '/', '{"app":"portal"}'::jsonb),
           ('legacy-admin-sess', 'page_view', 'page_view', '/analytics', '{"app":"admin"}'::jsonb)`,
      );
      const legacyContactInsert = await isoPool.query<{ id: string }>(
        `INSERT INTO contact_submissions (
           name, phone, email, message,
           attachment_name, attachment_mime_type, attachment_size_bytes,
           attachment_sha256, attachment_content_base64
         ) VALUES (
           'Legacy Contact', NULL, 'legacy@example.com',
           'Submitted prior to migration 0010 schema expansion.',
           NULL, NULL, NULL, NULL, NULL
         ) RETURNING id`,
      );
      const legacyContactId = legacyContactInsert.rows[0]?.id ?? '';
      expect(legacyContactId).toMatch(/^[0-9a-f-]{36}$/i);

      await isoPool.query(
        `INSERT INTO ask_turns (
           attempt_id, session_id, role, mode, prompt_hash, status,
           tokens_reserved, tokens_used, correlation_id, lease_expires_at, expires_at
         ) VALUES (
           'legacy-attempt-1', 'guest-legacy-1', 'guest', 'qa', 'hash-1', 'completed',
           100, 80, 'corr-legacy-1', NOW() + INTERVAL '5 minutes', NOW() + INTERVAL '15 minutes'
         )`,
      );
      await isoPool.query(
        `INSERT INTO roadmap_milestones (slug, status, label, sort_order, enabled)
         VALUES ('retention-check', 'active', 'Keep table intact', 1, true)`,
      );

      // 3. Apply 0010 via Drizzle migrator + verify idempotent SQL re-execution.
      await runMigrations(isoDb);
      await isoPool.query(up0010);

      const sessionColsAfterUp = await getTableColumns('analytics_sessions');
      for (const column of expectedSessionColumns) {
        expect(sessionColsAfterUp).toContain(column);
      }
      const contactColsAfterUp = await getTableColumns('contact_submissions');
      for (const column of expectedContactColumns) {
        expect(contactColsAfterUp).toContain(column);
      }

      const fkAfterUp = await isoPool.query<{ conname: string; confdeltype: string }>(
        `SELECT conname, confdeltype
         FROM pg_constraint
         WHERE conname = 'contact_submissions_analytics_session_id_fk'
           AND conrelid = '"contact_submissions"'::regclass`,
      );
      expect(fkAfterUp.rows).toEqual([
        { conname: 'contact_submissions_analytics_session_id_fk', confdeltype: 'n' },
      ]);

      const indexesAfterUp = await getExistingIndexes();
      expect(indexesAfterUp.toSorted()).toEqual([...expectedIndexes].toSorted());

      // Verify pre-0010 admin backfill & last_seen_at = started_at backfill.
      const backfilledSessions = await isoPool.query<{
        session_id: string;
        app: string;
        is_bot: boolean;
        started_at: Date;
        last_seen_at: Date | null;
      }>(
        `SELECT session_id, app, is_bot, started_at, last_seen_at
         FROM analytics_sessions
         WHERE session_id IN ('legacy-portal-sess', 'legacy-admin-sess')
         ORDER BY session_id`,
      );
      const adminRow = backfilledSessions.rows.find(r => r.session_id === 'legacy-admin-sess');
      const portalRow = backfilledSessions.rows.find(r => r.session_id === 'legacy-portal-sess');
      expect(adminRow?.app).toBe('admin');
      expect(adminRow?.is_bot).toBe(false);
      expect(adminRow?.last_seen_at?.toISOString()).toBe(adminRow?.started_at.toISOString());
      expect(portalRow?.app).toBe('portal');
      expect(portalRow?.is_bot).toBe(false);
      expect(portalRow?.last_seen_at?.toISOString()).toBe(portalRow?.started_at.toISOString());

      // Verify rolling-deploy compatibility: pre-0010 6-column analytics_sessions & 9-column contact_submissions inserts succeed.
      await isoPool.query(
        `INSERT INTO analytics_sessions (session_id, ip_hash, referrer, country, region, started_at)
         VALUES ('rolling-old-rev-sess', 'old-rev-ip-hash', NULL, NULL, NULL, NOW())`,
      );
      const rollingSess = await isoPool.query<{
        app: string;
        is_bot: boolean;
        last_seen_at: Date | null;
      }>(
        `SELECT app, is_bot, last_seen_at FROM analytics_sessions WHERE session_id = 'rolling-old-rev-sess'`,
      );
      expect(rollingSess.rows[0]).toEqual({ app: 'portal', is_bot: false, last_seen_at: null });

      const rollingContact = await isoPool.query<{
        analytics_session_id: string | null;
        guest_session_id: string | null;
      }>(
        `INSERT INTO contact_submissions (
           name, phone, email, message,
           attachment_name, attachment_mime_type, attachment_size_bytes,
           attachment_sha256, attachment_content_base64
         ) VALUES (
           'Rolling Contact', NULL, 'rolling@example.com',
           'Submitted from pre-0010 code against expanded 0010 schema.',
           NULL, NULL, NULL, NULL, NULL
         ) RETURNING analytics_session_id, guest_session_id`,
      );
      expect(rollingContact.rows[0]).toEqual({
        analytics_session_id: null,
        guest_session_id: null,
      });

      // Verify ON DELETE SET NULL FK preserves contact_submissions when linked analytics_sessions row is deleted.
      await isoPool.query(
        `INSERT INTO analytics_sessions (session_id, ip_hash) VALUES ('fk-delete-sess', 'fk-ip-hash')`,
      );
      const linkedContact = await isoPool.query<{ id: string }>(
        `INSERT INTO contact_submissions (name, email, message, analytics_session_id)
         VALUES ('Linked Visitor', 'linked@example.com', 'Linked submission testing ON DELETE SET NULL.', 'fk-delete-sess')
         RETURNING id`,
      );
      await isoPool.query(`DELETE FROM analytics_sessions WHERE session_id = 'fk-delete-sess'`);
      const afterSessionDelete = await isoPool.query<{ analytics_session_id: string | null }>(
        `SELECT analytics_session_id FROM contact_submissions WHERE id = $1::uuid`,
        [linkedContact.rows[0]?.id],
      );
      expect(afterSessionDelete.rows).toEqual([{ analytics_session_id: null }]);

      // Verify roadmap_milestones table and row remain completely untouched.
      const roadmapAfterUp = await isoPool.query<{ slug: string }>(
        `SELECT slug FROM roadmap_milestones WHERE slug = 'retention-check'`,
      );
      expect(roadmapAfterUp.rows).toEqual([{ slug: 'retention-check' }]);

      // 4. Roll back 0010 twice (verifying complete reversal, idempotency, and legacy row preservation).
      await isoPool.query(down0010);
      await isoPool.query(down0010);

      expect(await getExistingIndexes()).toHaveLength(0);
      const fkAfterDown = await isoPool.query(
        `SELECT conname FROM pg_constraint
         WHERE conname = 'contact_submissions_analytics_session_id_fk'
           AND conrelid = '"contact_submissions"'::regclass`,
      );
      expect(fkAfterDown.rows).toHaveLength(0);

      const sessionColsAfterDown = await getTableColumns('analytics_sessions');
      for (const column of expectedSessionColumns) {
        expect(sessionColsAfterDown).not.toContain(column);
      }
      expect(sessionColsAfterDown).toHaveLength(6);

      const contactColsAfterDown = await getTableColumns('contact_submissions');
      for (const column of expectedContactColumns) {
        expect(contactColsAfterDown).not.toContain(column);
      }

      // Legacy rows survive rollback intact.
      const survivingSessions = await isoPool.query<{ cnt: number }>(
        `SELECT COUNT(*)::int AS cnt FROM analytics_sessions
         WHERE session_id IN ('legacy-portal-sess', 'legacy-admin-sess')`,
      );
      expect(survivingSessions.rows[0]?.cnt).toBe(2);
      const survivingContact = await isoPool.query<{ id: string }>(
        `SELECT id FROM contact_submissions WHERE id = $1::uuid`,
        [legacyContactId],
      );
      expect(survivingContact.rows).toHaveLength(1);
      const survivingAskTurn = await isoPool.query<{ attempt_id: string }>(
        `SELECT attempt_id FROM ask_turns WHERE attempt_id = 'legacy-attempt-1'`,
      );
      expect(survivingAskTurn.rows).toHaveLength(1);

      // 5. Reapply 0010 forward and verify full schema, indexes, FK, and backfills restore cleanly.
      await isoPool.query(up0010);

      const indexesAfterReapply = await getExistingIndexes();
      expect(indexesAfterReapply.toSorted()).toEqual([...expectedIndexes].toSorted());
      const fkAfterReapply = await isoPool.query<{ conname: string; confdeltype: string }>(
        `SELECT conname, confdeltype
         FROM pg_constraint
         WHERE conname = 'contact_submissions_analytics_session_id_fk'
           AND conrelid = '"contact_submissions"'::regclass`,
      );
      expect(fkAfterReapply.rows).toEqual([
        { conname: 'contact_submissions_analytics_session_id_fk', confdeltype: 'n' },
      ]);

      const reappliedSessions = await isoPool.query<{
        session_id: string;
        app: string;
        started_at: Date;
        last_seen_at: Date | null;
      }>(
        `SELECT session_id, app, started_at, last_seen_at
         FROM analytics_sessions
         WHERE session_id IN ('legacy-portal-sess', 'legacy-admin-sess')`,
      );
      const reappliedAdmin = reappliedSessions.rows.find(r => r.session_id === 'legacy-admin-sess');
      const reappliedPortal = reappliedSessions.rows.find(
        r => r.session_id === 'legacy-portal-sess',
      );
      expect(reappliedAdmin?.app).toBe('admin');
      expect(reappliedAdmin?.last_seen_at?.toISOString()).toBe(
        reappliedAdmin?.started_at.toISOString(),
      );
      expect(reappliedPortal?.app).toBe('portal');
      expect(reappliedPortal?.last_seen_at?.toISOString()).toBe(
        reappliedPortal?.started_at.toISOString(),
      );
    } finally {
      if (isoPool) {
        await isoPool.end();
      }
      await pool.query(`DROP DATABASE IF EXISTS "${isolatedDbName}" WITH (FORCE)`);
      rmSync(tempPre0010Dir, { recursive: true, force: true });
    }
  });

  it('serializes concurrent SSR and client ingest under advisory locks, enforces portal/bot separation, cross-filters Admin Analytics, verifies Contact linking & Inbox PII purge', async () => {
    const testSalt = `pg-analytics-e2e-${Date.now()}`;
    const env = { ANALYTICS_DAILY_SALT: testSalt, PUBLIC_PORTAL_URL: 'https://andrew-k.us' };
    const now = new Date();
    const humanIp = '198.51.100.88';
    const humanUa =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
    const botIp = '198.51.100.89';
    const attackerIp = '203.0.113.77';
    const guestSessionId = `guest_link_${Date.now()}`;
    const attemptId = '88888888-8888-4888-8888-888888888888';

    const createdSessionIds: string[] = [];
    const createdContactIds: string[] = [];

    try {
      // 1. Concurrent disjoint-session_id SSR hit + client hydration batch race for the same visitor
      const ssrRequest = new Request(
        'https://andrew-k.us/?ref=recruiter&utm_source=linkedin&utm_medium=social&utm_campaign=fall26&secret=drop',
        {
          method: 'GET',
          headers: {
            host: 'andrew-k.us',
            'x-forwarded-for': humanIp,
            'x-cloud-country': 'US',
            'x-cloud-region': 'GA',
            'user-agent': humanUa,
            referer: 'https://www.linkedin.com/feed/update/999?token=strip',
          },
        },
      );
      const clientBatchRequest = new Request('https://andrew-k.us/api/analytics/ingest', {
        method: 'POST',
        headers: {
          host: 'andrew-k.us',
          'content-type': 'application/json',
          'x-forwarded-for': humanIp,
          'x-cloud-country': 'US',
          'x-cloud-region': 'GA',
          'user-agent': humanUa,
          referer: 'https://andrew-k.us/about',
        },
        body: JSON.stringify({
          sessionId: `client_disjoint_${Date.now()}`,
          landingPath: '/',
          events: [
            {
              type: 'page_view',
              name: 'portal_page_view',
              path: '/',
              metadata: { app: 'portal', navigation: 'initial' },
              timestamp: now.toISOString(),
            },
            {
              type: 'web_vital',
              name: 'LCP',
              path: '/',
              value: 920,
              timestamp: now.toISOString(),
            },
            {
              type: 'web_vital',
              name: 'INP',
              path: '/',
              value: 45,
              timestamp: now.toISOString(),
            },
            {
              type: 'web_vital',
              name: 'CLS',
              path: '/',
              value: 0.02,
              timestamp: now.toISOString(),
            },
            {
              type: 'web_vital',
              name: 'TTFB',
              path: '/',
              value: 140,
              timestamp: now.toISOString(),
            },
          ],
        }),
      });

      const [ssrRes, clientRes] = await Promise.all([
        capturePortalSsrHit(db, ssrRequest, { pathname: '/', env, now }),
        handleAnalyticsIngestRequest(clientBatchRequest, { db, env, app: 'portal', now }),
      ]);
      expect(ssrRes).not.toBeNull();
      expect(clientRes.status).toBe(202);
      const clientBody = (await clientRes.json()) as { accepted: number; sessionId: string };
      expect(clientBody.sessionId).toBe(ssrRes?.sessionId);
      const canonicalSessionId = ssrRes!.sessionId;
      createdSessionIds.push(canonicalSessionId);

      // Verify coupled tuple: 1 session row, intact first-touch attribution, and 1 deduplicated page_view
      const sessionRows = await pool.query<{
        session_id: string;
        app: string;
        is_bot: boolean;
        referrer_host: string | null;
        referrer_category: string | null;
        ref_param: string | null;
        utm_campaign: string | null;
      }>(
        `SELECT session_id, app, is_bot, referrer_host, referrer_category, ref_param, utm_campaign FROM analytics_sessions WHERE session_id = $1`,
        [canonicalSessionId],
      );
      expect(sessionRows.rows).toHaveLength(1);
      expect(sessionRows.rows[0]?.app).toBe('portal');
      expect(sessionRows.rows[0]?.is_bot).toBe(false);
      expect(sessionRows.rows[0]?.referrer_host).toBe('linkedin.com');
      expect(sessionRows.rows[0]?.referrer_category).toBe('social');
      expect(sessionRows.rows[0]?.ref_param).toBe('recruiter');
      expect(sessionRows.rows[0]?.utm_campaign).toBe('fall26');
      // Enrich city/org for geo + org assertion
      await pool.query(
        `UPDATE analytics_sessions SET city = 'Atlanta', asn_org = 'Acme Recruiting Fiber' WHERE session_id = $1`,
        [canonicalSessionId],
      );

      // Ensure first-touch referrer/campaign is preserved even if client won first or SSR won first
      // Trigger a second interaction batch with 20 non-web_vital events to test bounded 15-event trail
      const trailEvents = Array.from({ length: 20 }, (_, idx) => ({
        type: idx === 0 ? ('page_view' as const) : ('interaction' as const),
        name: idx === 0 ? 'portal_page_view' : idx % 2 === 0 ? 'pane_open' : 'terminal_command',
        path: idx === 0 ? '/about' : idx % 2 === 0 ? '/about' : '/',
        metadata: idx % 2 === 0 ? { surface: 'desktop' } : { command: 'about' },
        timestamp: new Date(now.getTime() + (idx + 1) * 1000).toISOString(),
      }));
      const secondBatchRes = await handleAnalyticsIngestRequest(
        new Request('https://andrew-k.us/api/analytics/ingest', {
          method: 'POST',
          headers: {
            host: 'andrew-k.us',
            'content-type': 'application/json',
            'x-forwarded-for': humanIp,
            'user-agent': humanUa,
          },
          body: JSON.stringify({
            sessionId: canonicalSessionId,
            events: trailEvents,
          }),
        }),
        { db, env, app: 'portal', now: new Date(now.getTime() + 25_000) },
      );
      expect(secondBatchRes.status).toBe(202);

      // Verify exactly 1 root '/' page_view (SSR + initial client deduplicated!) and 1 '/about' page_view
      const rootPvCount = await pool.query<{ cnt: number }>(
        `SELECT COUNT(*)::int AS cnt FROM analytics_events WHERE session_id = $1 AND type = 'page_view' AND path = '/'`,
        [canonicalSessionId],
      );
      expect(rootPvCount.rows[0]?.cnt).toBe(1);

      // 2. Bind guest session to portal analytics session + persist an ask_turns row
      const boundSessionId = await bindGuestSessionToAnalyticsSession(
        db,
        new Request('https://andrew-k.us/chat', {
          headers: { host: 'andrew-k.us', 'x-forwarded-for': humanIp, 'user-agent': humanUa },
        }),
        guestSessionId,
        { env, now: new Date(now.getTime() + 30_000) },
      );
      expect(boundSessionId).toBe(canonicalSessionId);

      await db.insert(askTurns).values({
        attemptId,
        sessionId: guestSessionId,
        role: 'guest',
        mode: 'jd_match',
        promptHash: 'd'.repeat(64),
        status: 'completed',
        tokensReserved: 500,
        tokensUsed: 250,
        promptText: 'Staff platform engineer role evaluating distributed Go and TypeScript',
        correlationId: 'corr-analytics-ask-1',
        leaseExpiresAt: new Date(now.getTime() + 60_000),
        expiresAt: new Date(now.getTime() + 900_000),
      });

      // 3. Ingest a bot portal session and an admin session
      const botRes = await capturePortalSsrHit(
        db,
        new Request('https://andrew-k.us/', {
          headers: { host: 'andrew-k.us', 'x-forwarded-for': botIp, 'user-agent': 'Googlebot/2.1' },
        }),
        { pathname: '/', env, now },
      );
      expect(botRes).not.toBeNull();
      createdSessionIds.push(botRes!.sessionId);

      const adminIngestRes = await handleAnalyticsIngestRequest(
        new Request('https://admin.andrew-k.us/api/analytics/ingest', {
          method: 'POST',
          headers: {
            host: 'admin.andrew-k.us',
            'content-type': 'application/json',
            'x-forwarded-for': humanIp,
            'user-agent': humanUa,
          },
          body: JSON.stringify({
            sessionId: `admin_sess_${Date.now()}`,
            events: [
              {
                type: 'page_view',
                name: 'admin_page_view',
                path: '/analytics',
                metadata: { app: 'portal' }, // spoofed; must persist as admin
                timestamp: now.toISOString(),
              },
            ],
          }),
        }),
        { db, env, app: 'admin', now },
      );
      const adminIngestBody = (await adminIngestRes.json()) as { sessionId: string };
      createdSessionIds.push(adminIngestBody.sessionId);

      // 4. Verified /contact linking: legitimate match, spoof rejection, fallback upsert, and PG 23503 FK retry
      const warnEvents: Record<string, unknown>[] = [];
      const logger = {
        info: () => {},
        warn: (obj: Record<string, unknown>) => warnEvents.push(obj),
        error: () => {},
      };

      const validLink = await resolveOrCreateContactAnalyticsSession(
        db,
        new Request('https://andrew-k.us/contact', {
          method: 'POST',
          headers: { host: 'andrew-k.us', 'x-forwarded-for': humanIp, 'user-agent': humanUa },
        }),
        { candidateSessionId: canonicalSessionId, guestSessionId, env, logger, now },
      );
      expect(validLink.analyticsSessionId).toBe(canonicalSessionId);
      expect(validLink.linkMethod).toBe('verified_client_session');
      expect(validLink.spoofRejected).toBe(false);

      // Spoof attempt from attacker targeting victim's session & admin's session
      const spoofLink = await resolveOrCreateContactAnalyticsSession(
        db,
        new Request('https://andrew-k.us/contact', {
          method: 'POST',
          headers: {
            host: 'andrew-k.us',
            'x-forwarded-for': attackerIp,
            'user-agent': 'Mozilla/5.0 Firefox/131.0',
          },
        }),
        { candidateSessionId: canonicalSessionId, env, logger, now },
      );
      expect(spoofLink.spoofRejected).toBe(true);
      expect(spoofLink.analyticsSessionId).not.toBe(canonicalSessionId);
      expect(spoofLink.linkMethod).toBe('fallback_upserted');
      if (spoofLink.analyticsSessionId) createdSessionIds.push(spoofLink.analyticsSessionId);
      expect(warnEvents).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            seam_type: 'UNSOUND_CONDITION',
            event: 'portal.contact.analytics_session_spoof_rejected',
          }),
        ]),
      );

      // Insert linked contact submission + unlinked legacy submission + PG 23503 retry submission
      const linkedContact = await insertContactSubmission(
        db,
        {
          name: 'Ada Lovelace',
          email: 'ada@example.com',
          phone: null,
          message: 'Interested in staff architecture consulting engagement.',
          attachment: null,
        },
        { analyticsSessionId: canonicalSessionId, guestSessionId },
      );
      createdContactIds.push(linkedContact.id);
      await recordContactSubmittedAnalyticsEvent(
        db,
        canonicalSessionId,
        new Date(now.getTime() + 40_000),
      );

      const fkRetryContact = await insertContactSubmission(
        db,
        {
          name: 'Grace Hopper',
          email: 'grace@example.com',
          phone: null,
          message: 'Testing fail-open retry when analytics session row is missing.',
          attachment: null,
        },
        { analyticsSessionId: 'non-existent-analytics-session-id', guestSessionId: null },
      );
      createdContactIds.push(fkRetryContact.id);
      expect(fkRetryContact.name).toBe('Grace Hopper');

      // 5. Verify UTC-midnight prior-day grace salt matching
      const preMidnight = new Date('2026-11-27T23:55:00.000Z');
      const postMidnight = new Date('2026-11-28T00:05:00.000Z');
      const midnightIp = '198.51.100.120';
      const midnightSsr = await capturePortalSsrHit(
        db,
        new Request('https://andrew-k.us/about', {
          headers: { host: 'andrew-k.us', 'x-forwarded-for': midnightIp, 'user-agent': humanUa },
        }),
        { pathname: '/about', env, now: preMidnight },
      );
      expect(midnightSsr).not.toBeNull();
      createdSessionIds.push(midnightSsr!.sessionId);

      const postMidnightLink = await resolveOrCreateContactAnalyticsSession(
        db,
        new Request('https://andrew-k.us/contact', {
          method: 'POST',
          headers: { host: 'andrew-k.us', 'x-forwarded-for': midnightIp, 'user-agent': humanUa },
        }),
        { env, now: postMidnight },
      );
      expect(postMidnightLink.analyticsSessionId).toBe(midnightSsr!.sessionId);
      expect(postMidnightLink.linkMethod).toBe('visitor_hash_match');

      // 6. Verify Admin Analytics queries: Top Paths non-inflation, filters, bounded 15-event trail, ask feed, Overview parity
      const filtered = await loadAdminAnalyticsData(db, {
        window: '24h',
        country: 'US',
        identified: 'true',
        bots: 'exclude',
      });
      expect(filtered.totalSessions).toBeGreaterThanOrEqual(1);
      expect(filtered.identifiedLeads).toBeGreaterThanOrEqual(1);
      expect(filtered.botSessionsExcluded).toBeGreaterThanOrEqual(1);

      // Top Paths excludes web_vital rows (root '/' has 1 page_view, NOT 5 with 4 web vitals!)
      const rootPathRow = filtered.topPaths.find(row => row.label === '/');
      expect(rootPathRow?.count).toBe(1);
      expect(rootPathRow?.uniqueVisitors).toBe(1);

      const visitor = filtered.recentVisitors?.find(v => v.sessionId === canonicalSessionId);
      expect(visitor).toBeDefined();
      expect(visitor?.contactName).toBe('Ada Lovelace');
      expect(visitor?.contactId).toBe(linkedContact.id);
      expect(visitor?.askTurnCount).toBe(1);
      expect(visitor?.trail.length).toBeLessThanOrEqual(15);
      expect(visitor?.trail.length).toBe(15);

      const askItem = filtered.askTurnsFeed?.find(a => a.attemptId === attemptId);
      expect(askItem).toBeDefined();
      expect(askItem?.mode).toBe('jd_match');
      expect(askItem?.contactName).toBe('Ada Lovelace');
      expect(askItem?.asnOrg).toBe('Acme Recruiting Fiber');

      const botsOnly = await loadAdminAnalyticsBreakdowns(db, { window: '24h', bots: 'only' });
      expect(botsOnly.recentVisitors?.every(v => v.isBot)).toBe(true);
      expect(botsOnly.recentVisitors?.some(v => v.sessionId === botRes!.sessionId)).toBe(true);
      expect(botsOnly.recentVisitors?.some(v => v.sessionId === adminIngestBody.sessionId)).toBe(
        false,
      );

      // Admin Home 24h KPIs match /analytics?window=24h (portal human only)
      const [overview, summary24h] = await Promise.all([
        loadAdminOverviewData(db),
        loadAdminAnalyticsSummary(db, '24h'),
      ]);
      expect(overview.metrics.sessions24h).toBe(summary24h.totalSessions);

      // 7. Verify Admin Inbox visitorContext + beyond-page-1 selectedItem + PII purge on delete
      const inboxPage = await listContactSubmissions(db, {
        page: 1,
        pageSize: 1,
        selectedId: linkedContact.id,
      });
      expect(inboxPage.selectedId).toBe(linkedContact.id);
      expect(inboxPage.selectedItem?.id).toBe(linkedContact.id);
      expect(inboxPage.selectedItem?.visitorContext?.analyticsSessionId).toBe(canonicalSessionId);
      expect(inboxPage.selectedItem?.visitorContext?.asnOrg).toBe('Acme Recruiting Fiber');
      expect(inboxPage.selectedItem?.visitorContext?.askTurnCount).toBe(1);
      expect(inboxPage.selectedItem?.visitorContext?.latestAskPromptExcerpt).toContain(
        'Staff platform engineer',
      );
      expect(inboxPage.selectedItem?.visitorContext?.viewedPaths).toEqual(
        expect.arrayContaining(['/', '/about']),
      );

      // Unlinked submission has null visitorContext; invalid selectedId does not throw
      const inboxInvalidSel = await listContactSubmissions(db, {
        selectedId: 'not-a-valid-uuid',
      });
      expect(inboxInvalidSel.selectedId).toBeNull();
      const unlinkedItem = inboxInvalidSel.items.find(item => item.id === fkRetryContact.id);
      expect(unlinkedItem?.visitorContext).toBeNull();

      // Deleting linked contact removes PII from Admin Analytics immediately while retaining session
      expect(await deleteContactSubmission(db, linkedContact.id)).toBe(true);
      const afterDelete = await loadAdminAnalyticsBreakdowns(db, {
        window: '24h',
        bots: 'exclude',
      });
      const visitorAfterDelete = afterDelete.recentVisitors?.find(
        v => v.sessionId === canonicalSessionId,
      );
      expect(visitorAfterDelete).toBeDefined();
      expect(visitorAfterDelete?.contactName).toBeNull();
      expect(visitorAfterDelete?.contactEmail).toBeNull();
      expect(visitorAfterDelete?.contactId).toBeNull();
    } finally {
      await db.delete(askTurns).where(eq(askTurns.attemptId, attemptId));
      for (const cid of createdContactIds) {
        await db.delete(contactSubmissions).where(eq(contactSubmissions.id, cid));
      }
      for (const sid of createdSessionIds) {
        await db.delete(analyticsEvents).where(eq(analyticsEvents.sessionId, sid));
        await db.delete(analyticsSessions).where(eq(analyticsSessions.sessionId, sid));
      }
    }
  });

  it('prevents cross-visitor sessionId hijacking, enforces idle/midnight rollover, bounds headers/hostnames/NULs, handles contact race, verifies seams, and keeps latest 90 trend days', async () => {
    if (!db) throw new Error('Expected ephemeral PostgreSQL database');
    const env = { ANALYTICS_DAILY_SALT: 'cycle2-hardening-salt' };
    const createdSessionIds: string[] = [];
    const createdContactIds: string[] = [];
    const infoLogs: Record<string, unknown>[] = [];
    const warnLogs: Record<string, unknown>[] = [];
    const logger: SsrStructuredLogger = {
      info: obj => {
        infoLogs.push(obj);
      },
      warn: obj => {
        warnLogs.push(obj);
      },
      error: () => undefined,
    };
    const humanUa =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36';

    try {
      // 1a. Victim opens a portal session; attacker sends victim's sessionId with attacker guestSessionId & bot UA
      const t0 = new Date('2026-11-27T12:00:00.000Z');
      const victimSsr = await capturePortalSsrHit(
        db,
        new Request('https://andrew-k.us/about/?ref=victim_ref', {
          headers: {
            host: 'andrew-k.us',
            'x-forwarded-for': '198.51.100.201',
            'user-agent': humanUa,
          },
        }),
        { pathname: '/about/', env, now: t0, logger },
      );
      expect(victimSsr).not.toBeNull();
      const victimSessionId = victimSsr!.sessionId;
      createdSessionIds.push(victimSessionId);

      // Trailing slash dedup: client initial page_view for /about/ deduplicates cleanly to 1 /about row
      const victimClientRes = await handleAnalyticsIngestRequest(
        new Request('https://andrew-k.us/api/analytics/ingest', {
          method: 'POST',
          headers: {
            host: 'andrew-k.us',
            'content-type': 'application/json',
            'x-forwarded-for': '198.51.100.201',
            'user-agent': humanUa,
          },
          body: JSON.stringify({
            sessionId: 'client-ephemeral-id',
            landingPath: '/about/',
            events: [
              {
                type: 'page_view',
                name: 'portal_page_view',
                path: '/about/',
                metadata: { app: 'portal', navigation: 'initial' },
                timestamp: new Date('2026-11-27T12:00:04.000Z').toISOString(),
              },
            ],
          }),
        }),
        { db, app: 'portal', env, now: new Date('2026-11-27T12:00:04.000Z'), logger },
      );
      expect(victimClientRes.status).toBe(202);
      const victimClientJson = (await victimClientRes.json()) as {
        accepted: number;
        sessionId: string;
      };
      expect(victimClientJson.sessionId).toBe(victimSessionId);
      expect(victimClientJson.accepted).toBe(0);

      const victimPvRows = await db
        .select({ path: analyticsEvents.path })
        .from(analyticsEvents)
        .where(eq(analyticsEvents.sessionId, victimSessionId));
      expect(victimPvRows).toEqual([{ path: '/about' }]);

      // Attacker attempts session hijack + is_bot sabotage + guest_session stamping on victimSessionId
      const attackerIngestRes = await handleAnalyticsIngestRequest(
        new Request('https://andrew-k.us/api/analytics/ingest', {
          method: 'POST',
          headers: {
            host: 'andrew-k.us',
            'content-type': 'application/json',
            'x-forwarded-for': '203.0.113.202',
            'user-agent': 'Googlebot/2.1 (+http://www.google.com/bot.html)',
          },
          body: JSON.stringify({
            sessionId: victimSessionId,
            events: [
              {
                type: 'interaction',
                name: 'hijack_attempt',
                path: '/about',
                timestamp: t0.toISOString(),
              },
            ],
          }),
        }),
        { db, app: 'portal', guestSessionId: 'guest_attacker_99', env, now: t0, logger },
      );
      expect(attackerIngestRes.status).toBe(202);
      const attackerIngestJson = (await attackerIngestRes.json()) as { sessionId: string };
      expect(attackerIngestJson.sessionId).not.toBe(victimSessionId);
      createdSessionIds.push(attackerIngestJson.sessionId);

      // Victim row remains untouched: is_bot still false, guest_session_id still null, zero hijack events
      const [victimRowAfterAttack] = await db
        .select()
        .from(analyticsSessions)
        .where(eq(analyticsSessions.sessionId, victimSessionId));
      expect(victimRowAfterAttack?.isBot).toBe(false);
      expect(victimRowAfterAttack?.guestSessionId).toBeNull();

      // Attacker submitting /contact with victimSessionId + attacker guestSessionId is STILL rejected
      const attackerContactLink = await resolveOrCreateContactAnalyticsSession(
        db,
        new Request('https://andrew-k.us/contact', {
          method: 'POST',
          headers: {
            host: 'andrew-k.us',
            'x-forwarded-for': '203.0.113.202',
            'user-agent': humanUa,
          },
        }),
        {
          candidateSessionId: victimSessionId,
          guestSessionId: 'guest_attacker_99',
          env,
          now: t0,
          logger,
        },
      );
      expect(attackerContactLink.spoofRejected).toBe(true);
      expect(attackerContactLink.analyticsSessionId).not.toBe(victimSessionId);
      if (attackerContactLink.analyticsSessionId) {
        createdSessionIds.push(attackerContactLink.analyticsSessionId);
      }

      // 1b. Cross-app isolation: admin ingest reusing a portal sessionId mints a fresh admin session
      const adminCollisionRes = await handleAnalyticsIngestRequest(
        new Request('https://admin.andrew-k.us/api/analytics/ingest', {
          method: 'POST',
          headers: {
            host: 'admin.andrew-k.us',
            'content-type': 'application/json',
            'x-forwarded-for': '198.51.100.201',
            'user-agent': humanUa,
          },
          body: JSON.stringify({
            sessionId: victimSessionId,
            events: [
              {
                type: 'page_view',
                name: 'admin_page_view',
                path: '/analytics',
                timestamp: t0.toISOString(),
              },
            ],
          }),
        }),
        { db, app: 'admin', env, now: t0, logger },
      );
      expect(adminCollisionRes.status).toBe(202);
      const adminCollisionJson = (await adminCollisionRes.json()) as { sessionId: string };
      expect(adminCollisionJson.sessionId).not.toBe(victimSessionId);
      createdSessionIds.push(adminCollisionJson.sessionId);

      // 1c. >30m idle rollover mints a fresh session even if client sends previous sessionId
      const tAfterIdle = new Date('2026-11-27T12:45:00.000Z');
      const rolloverRes = await handleAnalyticsIngestRequest(
        new Request('https://andrew-k.us/api/analytics/ingest', {
          method: 'POST',
          headers: {
            host: 'andrew-k.us',
            'content-type': 'application/json',
            'x-forwarded-for': '198.51.100.201',
            'user-agent': humanUa,
          },
          body: JSON.stringify({
            sessionId: victimSessionId,
            events: [
              {
                type: 'page_view',
                name: 'portal_page_view',
                path: '/agensi',
                timestamp: tAfterIdle.toISOString(),
              },
            ],
          }),
        }),
        { db, app: 'portal', env, now: tAfterIdle, logger },
      );
      expect(rolloverRes.status).toBe(202);
      const rolloverJson = (await rolloverRes.json()) as { sessionId: string };
      expect(rolloverJson.sessionId).not.toBe(victimSessionId);
      createdSessionIds.push(rolloverJson.sessionId);

      // 1d & 12b. >128-char sessionId and NUL bytes return HTTP 400 (never PG 54000 / 22021)
      const oversizedSidRes = await handleAnalyticsIngestRequest(
        new Request('https://andrew-k.us/api/analytics/ingest', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            sessionId: 'x'.repeat(129),
            events: [
              {
                type: 'page_view',
                name: 'portal_page_view',
                path: '/',
                timestamp: t0.toISOString(),
              },
            ],
          }),
        }),
        { db, app: 'portal', env, now: t0 },
      );
      expect(oversizedSidRes.status).toBe(400);

      const nulRes = await handleAnalyticsIngestRequest(
        new Request('https://andrew-k.us/api/analytics/ingest', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            sessionId: 'sess_nul',
            events: [
              {
                type: 'interaction',
                name: 'bad\u0000event',
                path: '/',
                timestamp: t0.toISOString(),
              },
            ],
          }),
        }),
        { db, app: 'portal', env, now: t0 },
      );
      expect(nulRes.status).toBe(400);

      // 2. Concurrent SSR hit vs /contact fallback race converges to exactly 1 session row
      const raceIp = '198.51.100.205';
      const raceTime = new Date('2026-11-27T14:00:00.000Z');
      const [raceSsr, raceContact] = await Promise.all([
        capturePortalSsrHit(
          db,
          new Request('https://andrew-k.us/?ref=race_ref&utm_campaign=race_camp', {
            headers: {
              host: 'andrew-k.us',
              referer: 'https://www.linkedin.com/feed/race',
              'x-forwarded-for': raceIp,
              'user-agent': humanUa,
            },
          }),
          { pathname: '/', env, now: raceTime, logger },
        ),
        resolveOrCreateContactAnalyticsSession(
          db,
          new Request('https://andrew-k.us/contact', {
            method: 'POST',
            headers: {
              host: 'andrew-k.us',
              'x-forwarded-for': raceIp,
              'user-agent': humanUa,
            },
          }),
          { env, now: raceTime, logger },
        ),
      ]);
      expect(raceSsr).not.toBeNull();
      expect(raceContact.analyticsSessionId).toBe(raceSsr!.sessionId);
      createdSessionIds.push(raceSsr!.sessionId);

      // 3b. Oversized 3,000-char Referer hostname and x-cloud-country/region never cause PG 54000
      const hugeHost = `${'sub.'.repeat(750)}example.com`;
      const hugeGeoRes = await handleAnalyticsIngestRequest(
        new Request('https://andrew-k.us/api/analytics/ingest', {
          method: 'POST',
          headers: {
            host: 'andrew-k.us',
            'content-type': 'application/json',
            'x-forwarded-for': '198.51.100.206',
            'user-agent': humanUa,
            referer: `https://${hugeHost}/landing`,
            'x-cloud-country': 'U'.repeat(3000),
            'x-cloud-region': 'G'.repeat(3000),
          },
          body: JSON.stringify({
            sessionId: 'sess_huge_headers',
            events: [
              {
                type: 'page_view',
                name: 'portal_page_view',
                path: '/',
                timestamp: t0.toISOString(),
              },
            ],
          }),
        }),
        { db, app: 'portal', env, now: t0 },
      );
      expect(hugeGeoRes.status).toBe(202);
      const hugeGeoJson = (await hugeGeoRes.json()) as { sessionId: string };
      createdSessionIds.push(hugeGeoJson.sessionId);
      const [hugeGeoRow] = await db
        .select()
        .from(analyticsSessions)
        .where(eq(analyticsSessions.sessionId, hugeGeoJson.sessionId));
      expect(hugeGeoRow?.referrerHost).toBeNull();
      expect(hugeGeoRow?.referrerCategory).toBe('direct');
      expect((hugeGeoRow?.country ?? '').length).toBeLessThanOrEqual(64);
      expect((hugeGeoRow?.region ?? '').length).toBeLessThanOrEqual(64);

      // 5. Observability seams: SSR timeout/rejection, contact link DB fault, bot & link branches
      const stalledDb = {
        transaction: () => new Promise(() => undefined),
      } as unknown as AppDatabase;
      const timedOutSsr = await capturePortalSsrHit(
        stalledDb,
        new Request('https://andrew-k.us/', { headers: { 'user-agent': humanUa } }),
        { timeoutMs: 20, correlationId: 'corr-ssr-timeout', logger },
      );
      expect(timedOutSsr).toBeNull();

      const failingDb = {
        transaction: async () => {
          throw new Error('simulated pg disconnect');
        },
        select: () => {
          throw new Error('simulated pg disconnect');
        },
        execute: async () => {
          throw new Error('simulated pg disconnect');
        },
      } as unknown as AppDatabase;
      const failedSsr = await capturePortalSsrHit(
        failingDb,
        new Request('https://andrew-k.us/', { headers: { 'user-agent': humanUa } }),
        { correlationId: 'corr-ssr-err', logger },
      );
      expect(failedSsr).toBeNull();

      const failedLink = await resolveOrCreateContactAnalyticsSession(
        failingDb,
        new Request('https://andrew-k.us/contact', {
          method: 'POST',
          headers: { 'user-agent': humanUa },
        }),
        { correlationId: 'corr-link-err', logger },
      );
      expect(failedLink.linkMethod).toBe('fail_open_null');
      expect(failedLink.analyticsSessionId).toBeNull();

      expect(
        warnLogs.some(
          l =>
            l['seam_type'] === 'BOUNDARY_FAULT' &&
            l['event'] === 'portal.analytics.ssr_capture_failed' &&
            l['correlationId'] === 'corr-ssr-timeout',
        ),
      ).toBe(true);
      expect(
        warnLogs.some(
          l =>
            l['seam_type'] === 'BOUNDARY_FAULT' &&
            l['event'] === 'portal.analytics.ssr_capture_failed' &&
            l['correlationId'] === 'corr-ssr-err',
        ),
      ).toBe(true);
      expect(
        warnLogs.some(
          l =>
            l['seam_type'] === 'BOUNDARY_FAULT' &&
            l['event'] === 'portal.contact.analytics_link_failed' &&
            l['correlationId'] === 'corr-link-err',
        ),
      ).toBe(true);
      expect(
        infoLogs.some(
          l =>
            l['seam_type'] === 'RULE_DIVERGENCE' &&
            l['event'] === 'analytics.ingest.bot_classification_branch' &&
            l['branch'] === 'human',
        ),
      ).toBe(true);
      expect(
        infoLogs.some(
          l =>
            l['seam_type'] === 'RULE_DIVERGENCE' &&
            l['event'] === 'analytics.ingest.bot_classification_branch' &&
            l['branch'] === 'bot_isbot',
        ),
      ).toBe(true);
      expect(
        infoLogs.some(
          l =>
            l['seam_type'] === 'RULE_DIVERGENCE' &&
            l['event'] === 'analytics.contact.link_method_branch' &&
            l['branch'] === 'fail_open_null',
        ),
      ).toBe(true);

      // 6a. insertContactSubmission triggers onAnalyticsSessionFkFallback on PG 23503 retry
      let fkFallbackFired = false;
      const fkContact = await insertContactSubmission(
        db,
        {
          name: 'Katherine Johnson',
          email: 'katherine@example.com',
          phone: null,
          message: 'Verifying FK fallback callback notification for truthful commit audit.',
          attachment: null,
        },
        {
          analyticsSessionId: 'missing-fk-session-id',
          guestSessionId: null,
          onAnalyticsSessionFkFallback: () => {
            fkFallbackFired = true;
          },
        },
      );
      createdContactIds.push(fkContact.id);
      expect(fkFallbackFired).toBe(true);

      // 9. Daily trend on window='all' across 100 distinct UTC days returns latest 90 days ascending including today
      const todayUtc = new Date();
      todayUtc.setUTCHours(12, 0, 0, 0);
      const trendBatchValues = Array.from({ length: 100 }, (_, i) => {
        const day = new Date(todayUtc.getTime() - i * 24 * 60 * 60 * 1000);
        const sid = `sess_trend_100d_${i}`;
        createdSessionIds.push(sid);
        return {
          sessionId: sid,
          ipHash: `trend_ip_${i}`,
          visitorHash: `trend_vis_${i}`,
          app: 'portal' as const,
          isBot: false,
          country: 'ZZ',
          startedAt: day,
          lastSeenAt: day,
        };
      });
      await db.insert(analyticsSessions).values(trendBatchValues);

      const allSummary = await loadAdminAnalyticsSummary(db, {
        window: 'all',
        country: 'ZZ',
        bots: 'exclude',
      });
      expect(allSummary.dailyTrend).toHaveLength(90);
      const dates = (allSummary.dailyTrend ?? []).map(p => p.date);
      expect(dates[dates.length - 1]).toBe(todayUtc.toISOString().slice(0, 10));
      const oldestExpected = new Date(todayUtc.getTime() - 89 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
      expect(dates[0]).toBe(oldestExpected);
      expect([...dates].sort()).toEqual(dates);
    } finally {
      for (const cid of createdContactIds) {
        await db.delete(contactSubmissions).where(eq(contactSubmissions.id, cid));
      }
      for (const sid of createdSessionIds) {
        await db.delete(analyticsEvents).where(eq(analyticsEvents.sessionId, sid));
        await db.delete(analyticsSessions).where(eq(analyticsSessions.sessionId, sid));
      }
    }
  });
});
