import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
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
import { eq, sql } from 'drizzle-orm';
import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  type AppDatabase,
  askTurns,
  CADENCE_PRESET_SEEDS,
  careerDossiers,
  claimPendingSandboxRun,
  cloneCachedSandboxRunForSession,
  completeSandboxRunRow,
  consumeQuotaForSession,
  consumeTotpBackupCode,
  ContactDbConstraintError,
  createDb,
  createDbPool,
  createPendingSandboxRunWithQuota,
  deleteCareerDossier,
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
  insertContactSubmission,
  isNodeDevUnlimitedEnabled,
  listAdminSandboxRuns,
  listCareerDossiers,
  listGoldenSandboxRuns,
  listPublishedCareerDossiers,
  listSandboxRunsForSession,
  loadAdminAnalyticsSummary,
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
  upsertAdminUserPassword,
  upsertCareerDossier,
  upsertCareerDossierBatch,
  upsertSiteContent,
  upsertTerminalDirectoryEntry,
  upsertUserTotpSecret,
  users,
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
      ['tui', 'TUI version'],
      ['cadence', 'Agentic workflow example'],
      ['chat', "Chat with Andrew's AI"],
      ['agensi', 'Published AI skills'],
      ['contact', 'Connect with me'],
      ['changes-in-progress', 'Maintenance preview'],
    ]);

    const expectedListing = [
      'tui                   # TUI version',
      'cadence               # Agentic workflow example',
      "chat                  # Chat with Andrew's AI",
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
});
