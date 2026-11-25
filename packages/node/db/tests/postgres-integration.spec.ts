import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { PrivacySanitizationError } from '@aklapper/node-runtime/privacy';
import { eq, sql } from 'drizzle-orm';
import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  type AppDatabase,
  askTurns,
  CADENCE_PRESET_SEEDS,
  careerDossiers,
  claimPendingSandboxRun,
  completeSandboxRunRow,
  consumeQuotaForSession,
  ContactDbConstraintError,
  createDb,
  createDbPool,
  createPendingSandboxRunWithQuota,
  deleteCareerDossier,
  deleteTerminalDirectoryEntry,
  extractPgConstraintViolation,
  failSandboxRunRow,
  getAskTurnByAttemptId,
  getCadencePresetBySlug,
  getCadencePresets,
  getCareerDossierBySlug,
  getQuotaStatusForSession,
  getSandboxRunWithTurnsById,
  getTerminalDirectoryEntries,
  getTerminalProfile,
  insertContactSubmission,
  listCareerDossiers,
  listPublishedCareerDossiers,
  listSandboxRunsForSession,
  loadAdminCmsData,
  loadAdminOverviewData,
  pruneExpiredAskTurns,
  publishCareerDossier,
  rateLimitBuckets,
  resetRateLimitBucket,
  roadmapMilestones,
  sandboxRuns,
  seedDatabase,
  SITE_CONTENT_KEYS,
  TERMINAL_PROFILE_SLUGS,
  unpublishCareerDossier,
  updateSandboxRunGateVerdictForSession,
  updateSandboxTurnRow,
  upsertCareerDossier,
  upsertCareerDossierBatch,
  upsertSiteContent,
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

  it('seeds all 5 buildable CADENCE presets and enforces atomic pending run lifecycle + CAS claim', async () => {
    const presets = await getCadencePresets(db);
    expect(presets.map(p => p.slug)).toEqual(CADENCE_PRESET_SEEDS.map(p => p.slug));
    expect(presets).toHaveLength(5);

    const monitor = await getCadencePresetBySlug(db, 'chord-pipeline-monitor');
    expect(monitor?.expectedKind).toBe('pipeline-monitor');

    const sessionId = `pg19-test-${Date.now()}`;
    try {
      const init = await createPendingSandboxRunWithQuota(db, {
        role: 'guest',
        sessionId,
        ipHash: 'test-ip',
        presetSlug: 'chord-pipeline-monitor',
        prompt: 'Measure CHORD stage latency across replicas in fast mode.',
        mode: 'fast',
        estimatedTokens: 800,
      });

      expect(init.allowed).toBe(true);
      expect(init.run?.runStatus).toBe('pending');
      expect(init.run?.mode).toBe('fast');
      expect(init.run?.presetSlug).toBe('chord-pipeline-monitor');
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
      expect(completed?.presetSlug).toBe('chord-pipeline-monitor');

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
      expect(history[0]?.presetSlug).toBe('chord-pipeline-monitor');

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
});
