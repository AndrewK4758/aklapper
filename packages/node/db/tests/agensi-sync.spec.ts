import { once } from 'node:events';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

import { eq, sql } from 'drizzle-orm';
import type { Pool } from 'pg';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import {
  agensiSkills,
  agensiSyncState,
  type AppDatabase,
  createDb,
  createDbPool,
  getAgensiSkills,
  syncAgensiCatalog,
} from '../src/index.ts';

async function startAgensiMock(
  handler: (req: IncomingMessage, res: ServerResponse) => void,
): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const server = createServer(handler);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const addr = server.address();
  if (!addr || typeof addr === 'string') throw new Error('Failed to bind Agensi mock server');
  return {
    baseUrl: `http://127.0.0.1:${addr.port}`,
    close: () =>
      new Promise<void>((resClose, rejClose) =>
        server.close(err => (err ? rejClose(err) : resClose())),
      ),
  };
}

describe('@aklapper/db transactional Agensi sync & row locking', () => {
  let pool: Pool;
  let db: AppDatabase;
  const closers: Array<() => Promise<void>> = [];
  const cleanupHandles = new Set<string>();
  const cleanupSlugs = new Set<string>();

  beforeAll(() => {
    pool = createDbPool();
    db = createDb(pool);
  });

  afterEach(async () => {
    while (closers.length > 0) {
      const fn = closers.pop();
      if (fn) await fn();
    }
    for (const slug of cleanupSlugs) {
      await db.delete(agensiSkills).where(eq(agensiSkills.slug, slug));
    }
    cleanupSlugs.clear();
    for (const handle of cleanupHandles) {
      await db.delete(agensiSyncState).where(eq(agensiSyncState.creatorHandle, handle));
      await db
        .delete(agensiSkills)
        .where(sql`lower(${agensiSkills.creatorHandle}) = lower(${handle})`);
    }
    cleanupHandles.clear();
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await pool.end();
  });

  it('upserts live items, deactivates creator-owned stale seed/api rows atomically without touching other creators', async () => {
    const handle = `sync-owner-${Date.now()}`;
    const otherHandle = `other-owner-${Date.now()}`;
    cleanupHandles.add(handle);
    cleanupHandles.add(otherHandle);
    cleanupSlugs.add('seed-stale-row');
    cleanupSlugs.add('retired-api-row');
    cleanupSlugs.add('other-creator-seed');
    cleanupSlugs.add('live-skill-a');
    cleanupSlugs.add('live-skill-b');

    await db.insert(agensiSkills).values([
      {
        slug: 'seed-stale-row',
        name: 'Legacy Seed',
        summary: 'Old seed placeholder.',
        tags: ['kubernetes'],
        url: 'https://agensi.io/skills/seed-stale-row',
        sortOrder: 1,
        creatorHandle: handle,
        isPublished: true,
        source: 'seed',
      },
      {
        slug: 'retired-api-row',
        name: 'Retired API Skill',
        summary: 'Previously synced.',
        tags: ['agents'],
        url: 'https://agensi.io/skills/retired-api-row',
        sortOrder: 2,
        creatorHandle: handle,
        isPublished: true,
        source: 'agensi_api',
      },
      {
        slug: 'other-creator-seed',
        name: 'Other Creator Seed',
        summary: 'Isolated creator row.',
        tags: ['other'],
        url: 'https://agensi.io/skills/other-creator-seed',
        sortOrder: 1,
        creatorHandle: otherHandle,
        isPublished: true,
        source: 'seed',
      },
    ]);

    const mock = await startAgensiMock((_req, res) => {
      res.setHeader('content-type', 'application/json');
      res.setHeader('etag', '"sync-v1"');
      res.end(
        JSON.stringify({
          items: [
            {
              slug: 'live-skill-a',
              name: 'Live Skill A',
              summary: 'Published skill A.',
              tags: ['sdlc'],
              url: 'https://agensi.io/skills/live-skill-a',
              creatorHandle: handle,
              isPublished: true,
              sortOrder: 1,
            },
            {
              slug: 'live-skill-b',
              name: 'Live Skill B',
              summary: 'Published skill B.',
              tags: ['tdd'],
              url: 'https://agensi.io/skills/live-skill-b',
              creatorHandle: handle,
              isPublished: true,
              sortOrder: 2,
            },
          ],
        }),
      );
    });
    closers.push(mock.close);

    const res = await syncAgensiCatalog(db, {
      forceRefresh: true,
      correlationId: 'corr-s2-1',
      env: {
        AGENSI_API_BASE_URL: mock.baseUrl,
        AGENSI_CREATOR_HANDLE: handle,
        AGENSI_CACHE_TTL_SECONDS: '300',
      },
    });

    expect(res.notModified).toBe(false);
    expect(res.syncedCount).toBe(2);
    expect(res.deactivatedCount).toBe(2);
    expect(res.syncState.lastStatus).toBe('ok');
    expect(res.syncState.itemCount).toBe(2);
    expect(res.syncState.lastSyncedAt).toBeTruthy();

    const active = await getAgensiSkills(db, handle);
    expect(active.map(s => s.slug)).toEqual(['live-skill-a', 'live-skill-b']);
    expect(active.every(s => s.source === 'agensi_api' && s.isPublished === true)).toBe(true);

    const [retiredRow] = await db
      .select()
      .from(agensiSkills)
      .where(eq(agensiSkills.slug, 'retired-api-row'));
    const [seedRow] = await db
      .select()
      .from(agensiSkills)
      .where(eq(agensiSkills.slug, 'seed-stale-row'));
    const [otherRow] = await db
      .select()
      .from(agensiSkills)
      .where(eq(agensiSkills.slug, 'other-creator-seed'));
    expect(retiredRow?.isPublished).toBe(false);
    expect(seedRow?.isPublished).toBe(false);
    expect(otherRow?.isPublished).toBe(true);
  });

  it('prevents concurrent stale overwrite via FOR UPDATE post-lock check and emits UNSOUND_CONDITION', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const handle = `lock-race-owner-${Date.now()}`;
    cleanupHandles.add(handle);
    cleanupSlugs.add('lock-race-stale-a');
    cleanupSlugs.add('lock-race-fresh-b');

    let workerAFetchStarted!: () => void;
    const workerAFetchPromise = new Promise<void>(r => {
      workerAFetchStarted = r;
    });
    let releaseWorkerA!: () => void;
    const gateWorkerA = new Promise<void>(r => {
      releaseWorkerA = r;
    });

    const dbA = createDb(pool);
    const dbB = createDb(pool);

    const env = {
      AGENSI_API_BASE_URL: 'https://agensi.io',
      AGENSI_CREATOR_HANDLE: handle,
      AGENSI_CACHE_TTL_SECONDS: '300',
    };

    const workerAFetch: typeof fetch = async () => {
      workerAFetchStarted();
      await gateWorkerA;
      return new Response(
        JSON.stringify({
          items: [
            {
              slug: 'lock-race-stale-a',
              name: 'Stale A',
              summary: 'Older fetched payload.',
              tags: ['stale'],
              url: 'https://agensi.io/skills/lock-race-stale-a',
              creatorHandle: handle,
              isPublished: true,
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    };

    const workerBFetch: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          items: [
            {
              slug: 'lock-race-fresh-b',
              name: 'Fresh B',
              summary: 'Newer committed payload.',
              tags: ['fresh'],
              url: 'https://agensi.io/skills/lock-race-fresh-b',
              creatorHandle: handle,
              isPublished: true,
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );

    const promiseA = syncAgensiCatalog(dbA, {
      forceRefresh: true,
      correlationId: 'corr-worker-a',
      env,
      fetchImpl: workerAFetch,
    });
    await workerAFetchPromise;

    await new Promise(resolve => setTimeout(resolve, 15));
    const resB = await syncAgensiCatalog(dbB, {
      forceRefresh: true,
      correlationId: 'corr-worker-b',
      env,
      fetchImpl: workerBFetch,
    });
    expect(resB.skills.map(s => s.slug)).toEqual(['lock-race-fresh-b']);

    releaseWorkerA();
    const resA = await promiseA;

    expect(resA.staleWriteSkipped).toBe(true);
    expect(resA.skills.map(s => s.slug)).toEqual(['lock-race-fresh-b']);
    const active = await getAgensiSkills(db, handle);
    expect(active.map(s => s.slug)).toEqual(['lock-race-fresh-b']);

    const warnOutput = warnSpy.mock.calls.map(c => String(c[0])).join('\n');
    expect(warnOutput).toContain('UNSOUND_CONDITION');
    expect(warnOutput).toContain('agensi.cache.stale_write_skipped');
  });

  it('handles HTTP 304 Not Modified without deactivating rows and handles empty 200 catalog + TX rollback', async () => {
    const handle = `sync-edge-${Date.now()}`;
    cleanupHandles.add(handle);
    cleanupSlugs.add('edge-skill-1');

    let mode: 'items' | '304' | 'empty' = 'items';
    let seenIfNoneMatch: string | undefined;
    const mock = await startAgensiMock((req, res) => {
      seenIfNoneMatch =
        typeof req.headers['if-none-match'] === 'string' ? req.headers['if-none-match'] : undefined;
      if (mode === '304') {
        res.statusCode = 304;
        res.setHeader('etag', '"etag-v1"');
        res.end();
        return;
      }
      res.setHeader('content-type', 'application/json');
      res.setHeader('etag', '"etag-v1"');
      res.end(
        JSON.stringify({
          items:
            mode === 'items'
              ? [
                  {
                    slug: 'edge-skill-1',
                    name: 'Edge Skill',
                    summary: 'Survives 304.',
                    tags: ['edge'],
                    url: 'https://agensi.io/skills/edge-skill-1',
                    creatorHandle: handle,
                    isPublished: true,
                  },
                ]
              : [],
        }),
      );
    });
    closers.push(mock.close);

    const env = {
      AGENSI_API_BASE_URL: mock.baseUrl,
      AGENSI_CREATOR_HANDLE: handle,
      AGENSI_CACHE_TTL_SECONDS: '0',
    };

    const initial = await syncAgensiCatalog(db, { env, forceRefresh: true });
    expect(initial.skills.map(s => s.slug)).toEqual(['edge-skill-1']);

    mode = '304';
    const notMod = await syncAgensiCatalog(db, { env });
    expect(seenIfNoneMatch).toBe('"etag-v1"');
    expect(notMod.notModified).toBe(true);
    expect(notMod.syncedCount).toBe(0);
    expect(notMod.deactivatedCount).toBe(0);
    expect(notMod.skills.map(s => s.slug)).toEqual(['edge-skill-1']);

    mode = 'empty';
    await expect(
      syncAgensiCatalog(db, {
        env,
        forceRefresh: true,
        onBeforeSyncStateCommitForTest: () => {
          throw new Error('simulated mid-tx failure');
        },
      }),
    ).rejects.toThrow(/simulated mid-tx failure/);
    expect((await getAgensiSkills(db, handle)).map(s => s.slug)).toEqual(['edge-skill-1']);

    const emptyRes = await syncAgensiCatalog(db, { env, forceRefresh: true });
    expect(emptyRes.skills).toEqual([]);
    expect(emptyRes.syncState.lastStatus).toBe('empty');
    expect(emptyRes.syncState.itemCount).toBe(0);
    expect(emptyRes.syncState.lastSyncedAt).toBeTruthy();
  });
});
