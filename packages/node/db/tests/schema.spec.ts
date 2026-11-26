import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { vi } from 'vitest';

import {
  agensiSkills,
  agensiSyncState,
  type AppDatabase,
  askTurns,
  CADENCE_PRESET_SEEDS,
  cadencePresets,
  CAREER_DOSSIER_SEEDS,
  careerDossiers,
  ContactDbConstraintError,
  contactSubmissions,
  DEFAULT_MENU_ITEMS,
  extractPgConstraintViolation,
  getPrerenderPortalAboutData,
  insertContactSubmission,
  menuItems,
  PORTAL_ABOUT_SEED,
  PORTAL_ASK_SEED,
  QDRANT_COLLECTIONS,
  roadmapMilestones,
  sandboxRuns,
  seedDatabase,
  SITE_CONTENT_KEYS,
  siteContent,
  TERMINAL_DIRECTORY_ENTRY_SEEDS,
  TERMINAL_PROFILE_SLUGS,
  terminalCommands,
  terminalDirectoryEntries,
  terminalInitialEntries,
  terminalProfiles,
  webauthnChallenges,
} from '../src/index.ts';

function createMockInsertDb(returningFn: () => Promise<unknown[]>) {
  const values = vi.fn<(row: Record<string, unknown>) => { returning: () => Promise<unknown[]> }>(
    () => ({ returning: returningFn }),
  );
  const insert = vi.fn<() => { values: typeof values }>(() => ({ values }));
  return {
    db: { insert } as unknown as AppDatabase,
    insert,
    values,
  };
}

describe('@aklapper/db', () => {
  it('defines Drizzle tables for portal/admin data and Qdrant vector collections', () => {
    expect(menuItems.slug.name).toBe('slug');
    expect('targetK8sDeploy' in menuItems).toBe(false);
    expect('namespace' in menuItems).toBe(false);
    const journal = JSON.parse(
      readFileSync(resolve(import.meta.dirname, '../drizzle/meta/_journal.json'), 'utf8'),
    ) as { entries: Array<{ idx: number; tag: string }> };
    expect(
      journal.entries.some(e => e.idx === 8 && e.tag === '0008_drop_menu_item_k8s_columns'),
    ).toBe(true);
    const upSql = readFileSync(
      resolve(import.meta.dirname, '../drizzle/0008_drop_menu_item_k8s_columns.sql'),
      'utf8',
    );
    const downSql = readFileSync(
      resolve(import.meta.dirname, '../drizzle/0008_drop_menu_item_k8s_columns.down.sql'),
      'utf8',
    );
    expect(upSql).toContain('DROP COLUMN IF EXISTS "target_k8s_deploy"');
    expect(upSql).toContain('DROP COLUMN IF EXISTS "namespace"');
    expect(upSql).toContain('WHERE "slug" = \'cadence\' AND "description" LIKE \'%GKE%\'');
    expect(downSql).toContain('ADD COLUMN IF NOT EXISTS "target_k8s_deploy"');
    expect(downSql).toContain('ADD COLUMN IF NOT EXISTS "namespace"');
    expect(sandboxRuns.artifactHtml.name).toBe('artifact_html');
    expect(sandboxRuns.isGolden.name).toBe('is_golden');
    expect(sandboxRuns.promptHash.name).toBe('prompt_hash');
    expect(sandboxRuns.executionMode.name).toBe('execution_mode');
    expect(sandboxRuns.specJson.name).toBe('spec_json');
    expect(sandboxRuns.gateAuditJson.name).toBe('gate_audit_json');
    expect(cadencePresets.starterArtifactHtml.name).toBe('starter_artifact_html');
    expect(contactSubmissions.attachmentSha256.name).toBe('attachment_sha256');
    expect(terminalProfiles.quickCommands.name).toBe('quick_commands');
    expect(terminalInitialEntries.profileSlug.name).toBe('profile_slug');
    expect(terminalCommands.allowedRoutes.name).toBe('allowed_routes');
    expect(
      journal.entries.some(e => e.idx === 9 && e.tag === '0009_retire_changes_in_progress_links'),
    ).toBe(true);
    // Contraction migration 0010_* must stay partitioned out of the journal and drizzle folder until rollout completes
    expect(journal.entries.some(e => e.tag.startsWith('0010_'))).toBe(false);
    const drizzleFiles = readdirSync(resolve(import.meta.dirname, '../drizzle'));
    expect(drizzleFiles.some(file => file.startsWith('0010_'))).toBe(false);
    expect(terminalDirectoryEntries.profileSlug.name).toBe('profile_slug');
    expect(terminalDirectoryEntries.description.name).toBe('description');
    expect(TERMINAL_DIRECTORY_ENTRY_SEEDS).toHaveLength(6);
    expect(TERMINAL_DIRECTORY_ENTRY_SEEDS.map(entry => String(entry.name))).toContain('about');
    expect(TERMINAL_DIRECTORY_ENTRY_SEEDS.map(entry => String(entry.name))).not.toContain(
      'changes-in-progress',
    );
    expect(TERMINAL_DIRECTORY_ENTRY_SEEDS.every(entry => !entry.name.endsWith('/'))).toBe(true);
    expect(roadmapMilestones.status.name).toBe('status');
    expect(webauthnChallenges.challenge.name).toBe('challenge');
    expect(webauthnChallenges.consumedAt.name).toBe('consumed_at');
    expect(webauthnChallenges.kind.name).toBe('kind');
    expect(askTurns.attemptId.name).toBe('attempt_id');
    expect(askTurns.leaseExpiresAt.name).toBe('lease_expires_at');
    expect(askTurns.expiresAt.name).toBe('expires_at');
    expect(askTurns.conversationId.name).toBe('conversation_id');
    expect(askTurns.turnIndex.name).toBe('turn_index');
    expect(askTurns.promptText.name).toBe('prompt_text');
    expect(careerDossiers.slug.name).toBe('slug');
    expect(careerDossiers.publishStatus.name).toBe('publish_status');
    expect(careerDossiers.sanitizationVerifiedAt.name).toBe('sanitization_verified_at');
    expect(careerDossiers.denylistHash.name).toBe('denylist_hash');
    expect(careerDossiers.searchTsv.name).toBe('search_tsv');
    expect(QDRANT_COLLECTIONS.map(c => [c.name, c.vectorSize])).toEqual([
      ['cadence_patterns', 768],
      ['portfolio_docs', 768],
    ]);
    expect(
      QDRANT_COLLECTIONS.every(c => c.vectorSize === 768 && c.distance === 'Cosine' && c.onDisk),
    ).toBe(true);
    expect(CADENCE_PRESET_SEEDS.map(p => p.slug)).toEqual([
      'chord-decomposition-workbench',
      'change-tier-gate-matrix',
      'expand-contract-migration',
      'five-boundary-resilience-audit',
      'spec-challenge-proof-ledger',
    ]);
    expect(DEFAULT_MENU_ITEMS.some(item => item.adminOnly)).toBe(true);
    expect(Object.keys(SITE_CONTENT_KEYS)).toHaveLength(10);
    expect(SITE_CONTENT_KEYS.portalAbout).toBe('portal-about');
    expect(SITE_CONTENT_KEYS.portalAgensi).toBe('portal-agensi');
    expect(SITE_CONTENT_KEYS.portalAsk).toBe('portal-ask');
    expect(SITE_CONTENT_KEYS.portalContact).toBe('portal-contact');
    expect(TERMINAL_PROFILE_SLUGS.portalHome).toBe('portal-home');
    expect(TERMINAL_PROFILE_SLUGS.adminOps).toBe('admin-ops');
    expect('portalMaintenance' in TERMINAL_PROFILE_SLUGS).toBe(false);
    expect(agensiSkills.creatorHandle.name).toBe('creator_handle');
    expect(agensiSkills.isPublished.name).toBe('is_published');
    expect(agensiSkills.syncedAt.name).toBe('synced_at');
    expect(agensiSkills.source.name).toBe('source');
    expect(agensiSyncState.creatorHandle.name).toBe('creator_handle');
    expect(agensiSyncState.lastSyncedAt.name).toBe('last_synced_at');
    expect(agensiSyncState.lastAttemptAt.name).toBe('last_attempt_at');
    expect(agensiSyncState.lastStatus.name).toBe('last_status');
    expect(agensiSyncState.lastError.name).toBe('last_error');
    expect(agensiSyncState.itemCount.name).toBe('item_count');
    expect(agensiSyncState.etag.name).toBe('etag');
  });

  it('maps Postgres 19 CHECK and NOT NULL errors to ContactDbConstraintError', () => {
    const checkErr = extractPgConstraintViolation({
      code: '23514',
      constraint: 'contact_email_format_check',
    });
    expect(checkErr).toBeInstanceOf(ContactDbConstraintError);
    expect(checkErr?.constraintName).toBe('contact_email_format_check');
    expect(checkErr?.fieldErrors['email']).toHaveLength(1);

    const wrappedErr = extractPgConstraintViolation({
      cause: {
        code: '23514',
        constraint: 'contact_attachment_consistency_check',
      },
    });
    expect(wrappedErr).toBeInstanceOf(ContactDbConstraintError);
    expect(wrappedErr?.fieldErrors['file']).toHaveLength(1);

    const notNullErr = extractPgConstraintViolation({
      code: '23502',
      column: 'message',
    });
    expect(notNullErr).toBeInstanceOf(ContactDbConstraintError);
    expect(notNullErr?.fieldErrors['message']).toHaveLength(1);

    const attachmentNotNullErr = extractPgConstraintViolation({
      code: '23502',
      column: 'attachment_sha256',
    });
    expect(attachmentNotNullErr).toBeInstanceOf(ContactDbConstraintError);
    expect(attachmentNotNullErr?.fieldErrors['file']).toHaveLength(1);

    const unknownCheckErr = extractPgConstraintViolation({
      code: '23514',
      constraint: 'custom_unknown_check',
    });
    expect(unknownCheckErr).toBeInstanceOf(ContactDbConstraintError);
    expect(unknownCheckErr?.fieldErrors).toEqual({});

    expect(extractPgConstraintViolation(new Error('unrelated'))).toBeNull();
  });

  it('persists normalized contact submissions and translates DB constraint failures', async () => {
    const createdAt = new Date('2026-11-24T12:00:00.000Z');
    const sha256 = 'a'.repeat(64);
    const { db, values } = createMockInsertDb(async () => [
      {
        id: '11111111-1111-4111-8111-111111111111',
        name: 'Grace Hopper',
        email: 'grace@example.com',
        phone: '+1 (555) 867-5309',
        attachmentName: 'notes.txt',
        attachmentSizeBytes: 12,
        attachmentSha256: sha256,
        createdAt,
      },
    ]);

    const summary = await insertContactSubmission(db, {
      name: '  Grace Hopper  ',
      phone: '+1 (555) 867-5309',
      email: '  GRACE@EXAMPLE.COM ',
      message: 'Validating normalized persistence and ISO timestamp formatting.',
      attachment: {
        filename: 'notes.txt',
        mimeType: 'text/plain',
        sizeBytes: 12,
        sha256,
        contentBase64: Buffer.from('hello world!').toString('base64'),
      },
    });

    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Grace Hopper',
        email: 'grace@example.com',
        attachmentName: 'notes.txt',
        attachmentSha256: sha256,
      }),
    );
    expect(summary).toEqual({
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Grace Hopper',
      email: 'grace@example.com',
      phone: '+1 (555) 867-5309',
      attachmentName: 'notes.txt',
      attachmentSizeBytes: 12,
      attachmentSha256: sha256,
      createdAt: '2026-11-24T12:00:00.000Z',
    });

    // Rejects invalid input via Zod before touching db.insert
    const { db: untouchedDb, insert: untouchedInsert } = createMockInsertDb(async () => []);
    await expect(
      insertContactSubmission(untouchedDb, {
        name: 'A',
        phone: null,
        email: 'bad',
        message: 'short',
        attachment: null,
      }),
    ).rejects.toThrow(/at least 2/i);
    expect(untouchedInsert).not.toHaveBeenCalled();

    // Translates Postgres 23514 error to ContactDbConstraintError
    const { db: constraintDb } = createMockInsertDb(async () => {
      throw { code: '23514', constraint: 'contact_email_format_check' };
    });
    await expect(
      insertContactSubmission(constraintDb, {
        name: 'Grace Hopper',
        phone: null,
        email: 'grace@example.com',
        message: 'Testing database CHECK constraint error translation.',
        attachment: null,
      }),
    ).rejects.toBeInstanceOf(ContactDbConstraintError);

    // Throws when INSERT RETURNING yields no row
    const { db: emptyReturnDb } = createMockInsertDb(async () => []);
    await expect(
      insertContactSubmission(emptyReturnDb, {
        name: 'Grace Hopper',
        phone: null,
        email: 'grace@example.com',
        message: 'Testing empty returning row guard.',
        attachment: null,
      }),
    ).rejects.toThrow(/Failed to persist contact submission/i);
  });

  it('prunes retired maintenance and changes-in-progress rows in upsert mode while keeping bootstrap non-destructive', async () => {
    const deleteCalls: unknown[] = [];
    const onConflictUpdateCalls: unknown[] = [];
    const onConflictNothingCalls: unknown[] = [];
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    const onConflictDoUpdate = vi.fn<() => Promise<void>>(async () => {
      onConflictUpdateCalls.push(lastTable);
    });
    const onConflictDoNothing = vi.fn<() => Promise<void>>(async () => {
      onConflictNothingCalls.push(lastTable);
    });
    const whereFn = vi.fn<() => Promise<void>>(async () => {
      deleteCalls.push(lastTable);
    });
    let lastTable: unknown = null;

    const mockDb = {
      select: vi.fn<
        () => {
          from: () => {
            where: () => {
              limit: () => Promise<Array<{ slug: string }>>;
            };
          };
        }
      >(() => ({
        from: () => ({
          where: () => ({
            limit: async () => [{ slug: 'live-agensi-skill' }],
          }),
        }),
      })),
      insert: vi.fn<
        (table: unknown) => {
          values: () => {
            onConflictDoUpdate: typeof onConflictDoUpdate;
            onConflictDoNothing: typeof onConflictDoNothing;
          };
        }
      >(table => {
        lastTable = table;
        return {
          values: () => ({
            onConflictDoUpdate,
            onConflictDoNothing,
          }),
        };
      }),
      delete: vi.fn<(table: unknown) => { where: typeof whereFn }>(table => {
        lastTable = table;
        return { where: whereFn };
      }),
      transaction: vi.fn<(fn: (tx: unknown) => Promise<unknown>) => Promise<unknown>>(async fn =>
        fn(mockDb),
      ),
    } as unknown as AppDatabase;

    try {
      await seedDatabase(mockDb, { ADMIN_PASSWORD: '' });
      expect(deleteCalls).toEqual([
        menuItems,
        siteContent,
        terminalProfiles,
        terminalCommands,
        terminalDirectoryEntries,
      ]);
      expect(onConflictUpdateCalls.length).toBeGreaterThan(0);
      expect(onConflictUpdateCalls).toContain(careerDossiers);
      expect(onConflictUpdateCalls).not.toContain(roadmapMilestones);

      deleteCalls.length = 0;
      onConflictUpdateCalls.length = 0;
      await seedDatabase(mockDb, { mode: 'bootstrap', env: { ADMIN_PASSWORD: '' } });
      expect(deleteCalls).toHaveLength(0);
      expect(onConflictUpdateCalls).toHaveLength(0);
      expect(onConflictNothingCalls.length).toBeGreaterThan(0);
      expect(onConflictNothingCalls).not.toContain(roadmapMilestones);

      expect(DEFAULT_MENU_ITEMS.some(item => item.slug === 'chat')).toBe(true);
      expect(DEFAULT_MENU_ITEMS.some(item => item.slug === 'ask')).toBe(false);
      expect(TERMINAL_DIRECTORY_ENTRY_SEEDS.map(entry => entry.name)).toContain('chat');
      expect(TERMINAL_DIRECTORY_ENTRY_SEEDS.map(entry => entry.name)).not.toContain('ask');
      expect(TERMINAL_DIRECTORY_ENTRY_SEEDS.map(entry => entry.name)).not.toContain('menu');
      expect(TERMINAL_DIRECTORY_ENTRY_SEEDS.map(entry => entry.name)).not.toContain(
        'changes-in-progress',
      );
      expect(PORTAL_ASK_SEED.windowTitle).toContain('Chat with Andrew');
      const profileDossier = CAREER_DOSSIER_SEEDS.find(
        d => d.slug === 'andrew-klapper-profile-core',
      );
      expect(JSON.stringify(profileDossier?.sectionsJson)).toContain('/chat');
      expect(JSON.stringify(profileDossier?.sectionsJson)).not.toContain('/ask');

      const logged = infoSpy.mock.calls.flat().join('\n');
      expect(logged).toContain('db.seed.mode_branch');
      expect(logged).toContain('RULE_DIVERGENCE');
      expect(logged).toContain('bootstrap_missing_only');
      expect(logged).toContain('upsert_safe');

      // Exported process.env.mode='bootstrap' must NOT hijack default upsert mode on seedDatabase(db)
      const prevModeEnv = process.env['mode'];
      const prevAdminPassword = process.env['ADMIN_PASSWORD'];
      const prevNodeEnv = process.env['NODE_ENV'];
      try {
        process.env['mode'] = 'bootstrap';
        process.env['ADMIN_PASSWORD'] = '';
        process.env['NODE_ENV'] = 'test';
        infoSpy.mockClear();
        onConflictUpdateCalls.length = 0;
        await seedDatabase(mockDb);
        expect(onConflictUpdateCalls.length).toBeGreaterThan(0);
        expect(infoSpy.mock.calls.flat().join('\n')).toContain('upsert_safe');
      } finally {
        if (prevModeEnv === undefined) delete process.env['mode'];
        else process.env['mode'] = prevModeEnv;
        if (prevAdminPassword === undefined) delete process.env['ADMIN_PASSWORD'];
        else process.env['ADMIN_PASSWORD'] = prevAdminPassword;
        if (prevNodeEnv === undefined) delete process.env['NODE_ENV'];
        else process.env['NODE_ENV'] = prevNodeEnv;
      }
    } finally {
      infoSpy.mockRestore();
    }
  });

  it('seeds 10 sanitized resume dossiers within Go 1400-rune chunk bounds, excludes personal contacts/phones/ZIPs, and provides prerender /about data', () => {
    expect(CAREER_DOSSIER_SEEDS).toHaveLength(10);
    expect(CAREER_DOSSIER_SEEDS.map(d => d.slug)).toEqual([
      'andrew-klapper-profile-core',
      'btg-software-engineer',
      'gitasy-software-engineer',
      'shipping-services-logistics-owner',
      'cadence-agentic-sdlc',
      'ghostty-union-terminal',
      'gemma-4-dual-gpu-finetuning',
      'distributed-ai-document-ecosystem',
      'antigravity-android-blitz-oss',
      'woodstock-developers-group-mentor',
    ]);

    for (const dossier of CAREER_DOSSIER_SEEDS) {
      const metaParts = [
        `Domain: ${dossier.domainLabel.trim()}`,
        `Role: ${dossier.roleTitle.trim()}`,
        `Timeframe: ${dossier.timeframe.trim()}`,
        ...(dossier.skills.length > 0 ? [`Skills: ${dossier.skills.join(', ')}`] : []),
      ];
      const chunk0 = `${dossier.summaryBody.trim()}\n${metaParts.join(' | ')}`;
      expect(
        Array.from(chunk0).length,
        `${dossier.slug} Chunk #0 exceeds 1400 runes`,
      ).toBeLessThanOrEqual(1400);
      for (const section of dossier.sectionsJson) {
        const sectionChunk = `${section.heading.trim()}: ${section.body.trim()}`;
        expect(
          Array.from(sectionChunk).length,
          `${dossier.slug} section "${section.heading}" exceeds 1400 runes`,
        ).toBeLessThanOrEqual(1400);
      }
    }

    expect(PORTAL_ABOUT_SEED.skillGroups).toHaveLength(5);
    expect(PORTAL_ABOUT_SEED.services.map(s => s.to)).toEqual(['/chat', '/agensi', '/cadence']);
    expect(PORTAL_ABOUT_SEED.contactCtaHref).toBe('/contact');

    const serializedAll = JSON.stringify({ PORTAL_ABOUT_SEED, CAREER_DOSSIER_SEEDS });
    expect(serializedAll).not.toMatch(/\bref(?:erence)?s\b/i);
    expect(serializedAll).not.toMatch(/(?:\(\d{3}\)[-.\s]?|\d{3}[-.\s])\d{3}[-.\s]\d{4}/);
    expect(serializedAll).not.toMatch(/\b[A-Z]{2}\s+\d{5}(?:-\d{4})?\b/);
    expect(serializedAll).not.toMatch(/\b\d{5}-\d{4}\b/);

    const prerenderAbout = getPrerenderPortalAboutData();
    expect(prerenderAbout.content.identity.fullName).toBe('Andrew Klapper');
    expect(prerenderAbout.dossiers).toHaveLength(10);
    expect(prerenderAbout.brandContactEmail).toBe('andrew@andrew-k.us');
  });
});
