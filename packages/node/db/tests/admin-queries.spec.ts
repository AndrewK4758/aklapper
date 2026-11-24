import { vi } from 'vitest';

import {
  type AppDatabase,
  deleteContactSubmission,
  deleteTerminalCommand,
  deleteTerminalInitialEntry,
  getAskTurnByAttemptId,
  getContactSubmissionAttachment,
  overrideSandboxGateVerdict,
  purgeStaleRateLimitBuckets,
  resetRateLimitBucket,
  updateQuotaPolicy,
  upsertSiteContent,
} from '../src/index.ts';

function createReturningMockDb(result: unknown[]) {
  const returning = vi.fn<() => Promise<unknown[]>>().mockResolvedValue(result);
  const where = vi.fn<() => { returning: typeof returning }>(() => ({ returning }));
  const set = vi.fn<() => { where: typeof where }>(() => ({ where }));
  const onConflictDoUpdate = vi.fn<() => { returning: typeof returning }>(() => ({ returning }));
  const values = vi.fn<() => { onConflictDoUpdate: typeof onConflictDoUpdate }>(() => ({
    onConflictDoUpdate,
  }));

  return {
    db: {
      insert: vi.fn<() => { values: typeof values }>(() => ({ values })),
      update: vi.fn<() => { set: typeof set }>(() => ({ set })),
      delete: vi.fn<() => { where: typeof where }>(() => ({ where })),
    } as unknown as AppDatabase,
    returning,
    values,
    set,
    where,
  };
}

describe('@aklapper/db admin queries & mutations', () => {
  it('rejects non-UUID identifiers safely before querying PG19', async () => {
    const db = {
      select: vi.fn<() => unknown>(),
      update: vi.fn<() => unknown>(),
      delete: vi.fn<() => unknown>(),
    } as unknown as AppDatabase;

    expect(await getContactSubmissionAttachment(db, 'not-a-uuid')).toBeNull();
    expect(await getAskTurnByAttemptId(db, 'not-a-uuid', 'guest_1')).toBeNull();
    expect(await deleteContactSubmission(db, 'not-a-uuid')).toBe(false);
    expect(await overrideSandboxGateVerdict(db, 'not-a-uuid', 'approved')).toBeNull();
    expect(await deleteTerminalCommand(db, -1)).toBe(false);
    expect(await deleteTerminalInitialEntry(db, 0)).toBe(false);

    expect(db.select).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
    expect(db.delete).not.toHaveBeenCalled();
  });

  it('validates known site_content schemas on upsertSiteContent', async () => {
    const { db } = createReturningMockDb([
      {
        key: 'admin-analytics',
        markdownBody: '# Analytics',
        metadataJson: {
          windowTitle: 'Analytics // PG19',
          description: 'Live telemetry.',
        },
        updatedAt: new Date('2026-11-24T12:00:00.000Z'),
      },
    ]);

    await expect(
      upsertSiteContent(db, 'admin-analytics', '# Broken', { invalidField: true }),
    ).rejects.toThrow(/Invalid/i);

    const saved = await upsertSiteContent(db, 'admin-analytics', '# Analytics', {
      windowTitle: 'Analytics // PG19',
      description: 'Live telemetry.',
    });
    expect(saved.key).toBe('admin-analytics');
    expect(saved.metadataJson['windowTitle']).toBe('Analytics // PG19');
  });

  it('updates quota policies, resets buckets, and purges stale buckets', async () => {
    const policyMock = createReturningMockDb([
      {
        role: 'guest',
        maxTurnsPerSession: 7,
        maxTokensPerRun: 5000,
        maxDailyGlobalTokens: 120000,
      },
    ]);
    const policy = await updateQuotaPolicy(policyMock.db, {
      role: 'guest',
      maxTurnsPerSession: 7,
      maxTokensPerRun: 5000,
      maxDailyGlobalTokens: 120000,
    });
    expect(policy.maxTurnsPerSession).toBe(7);

    const resetMock = createReturningMockDb([{ scopeKey: 'session:abc' }]);
    expect(await resetRateLimitBucket(resetMock.db, 'session:abc')).toBe(true);

    const purgeMock = createReturningMockDb([
      { scopeKey: 'session:old-1' },
      { scopeKey: 'session:old-2' },
    ]);
    expect(await purgeStaleRateLimitBuckets(purgeMock.db, 24)).toBe(2);
  });
});
