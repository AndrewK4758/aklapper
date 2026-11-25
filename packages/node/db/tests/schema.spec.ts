import { vi } from 'vitest';

import {
  agensiSkills,
  agensiSyncState,
  type AppDatabase,
  askTurns,
  CADENCE_PRESET_SEEDS,
  cadencePresets,
  ContactDbConstraintError,
  contactSubmissions,
  DEFAULT_MENU_ITEMS,
  extractPgConstraintViolation,
  insertContactSubmission,
  menuItems,
  QDRANT_COLLECTIONS,
  roadmapMilestones,
  sandboxRuns,
  seedDatabase,
  SITE_CONTENT_KEYS,
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
    expect(sandboxRuns.artifactHtml.name).toBe('artifact_html');
    expect(cadencePresets.starterArtifactHtml.name).toBe('starter_artifact_html');
    expect(contactSubmissions.attachmentSha256.name).toBe('attachment_sha256');
    expect(terminalProfiles.quickCommands.name).toBe('quick_commands');
    expect(terminalInitialEntries.profileSlug.name).toBe('profile_slug');
    expect(terminalCommands.allowedRoutes.name).toBe('allowed_routes');
    expect(terminalDirectoryEntries.profileSlug.name).toBe('profile_slug');
    expect(terminalDirectoryEntries.description.name).toBe('description');
    expect(TERMINAL_DIRECTORY_ENTRY_SEEDS).toHaveLength(7);
    expect(TERMINAL_DIRECTORY_ENTRY_SEEDS.every(entry => !entry.name.endsWith('/'))).toBe(true);
    expect(roadmapMilestones.status.name).toBe('status');
    expect(webauthnChallenges.challenge.name).toBe('challenge');
    expect(webauthnChallenges.consumedAt.name).toBe('consumed_at');
    expect(webauthnChallenges.kind.name).toBe('kind');
    expect(askTurns.attemptId.name).toBe('attempt_id');
    expect(askTurns.leaseExpiresAt.name).toBe('lease_expires_at');
    expect(askTurns.expiresAt.name).toBe('expires_at');
    expect(QDRANT_COLLECTIONS.map(c => [c.name, c.vectorSize])).toEqual([
      ['cadence_patterns', 768],
      ['portfolio_docs', 768],
    ]);
    expect(
      QDRANT_COLLECTIONS.every(c => c.vectorSize === 768 && c.distance === 'Cosine' && c.onDisk),
    ).toBe(true);
    expect(CADENCE_PRESET_SEEDS.map(p => p.slug)).toEqual([
      'solar-forge-starter',
      'k8s-pod-telemetry',
      'chord-pipeline-monitor',
      'qdrant-rag-inspector',
      'zero-trust-gate-panel',
    ]);
    expect(DEFAULT_MENU_ITEMS.some(item => item.adminOnly)).toBe(true);
    expect(Object.keys(SITE_CONTENT_KEYS)).toHaveLength(11);
    expect(SITE_CONTENT_KEYS.portalAgensi).toBe('portal-agensi');
    expect(SITE_CONTENT_KEYS.portalAsk).toBe('portal-ask');
    expect(SITE_CONTENT_KEYS.portalContact).toBe('portal-contact');
    expect(TERMINAL_PROFILE_SLUGS.portalHome).toBe('portal-home');
    expect(TERMINAL_PROFILE_SLUGS.adminOps).toBe('admin-ops');
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

  it('preserves custom roadmap_milestones by default, supports non-overwriting bootstrap mode, and gates pruning behind pruneMissingMilestones', async () => {
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
    } as unknown as AppDatabase;

    try {
      await seedDatabase(mockDb, { ADMIN_PASSWORD: '' });
      expect(deleteCalls).toHaveLength(0);
      expect(onConflictUpdateCalls.length).toBeGreaterThan(0);

      onConflictUpdateCalls.length = 0;
      await seedDatabase(mockDb, { mode: 'bootstrap', env: { ADMIN_PASSWORD: '' } });
      expect(deleteCalls).toHaveLength(0);
      expect(onConflictUpdateCalls).toHaveLength(0);
      expect(onConflictNothingCalls.length).toBeGreaterThan(0);

      await seedDatabase(mockDb, { pruneMissingMilestones: true, env: { ADMIN_PASSWORD: '' } });
      expect(deleteCalls).toEqual([roadmapMilestones]);

      const logged = infoSpy.mock.calls.flat().join('\n');
      expect(logged).toContain('db.seed.mode_branch');
      expect(logged).toContain('RULE_DIVERGENCE');
      expect(logged).toContain('bootstrap_missing_only');
      expect(logged).toContain('explicit_prune_roadmap');
    } finally {
      infoSpy.mockRestore();
    }
  });
});
