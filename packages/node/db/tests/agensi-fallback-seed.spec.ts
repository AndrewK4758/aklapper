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
  loadAdminCmsData,
  loadCreatorAgensiCatalog,
  loadPortalAgensiData,
  seedDatabase,
  syncAgensiCatalog,
} from '../src/index.ts';

async function startServer(
  handler: (req: IncomingMessage, res: ServerResponse) => void,
): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const srv = createServer(handler);
  srv.listen(0, '127.0.0.1');
  await once(srv, 'listening');
  const addr = srv.address();
  if (!addr || typeof addr === 'string') throw new Error('Failed to bind mock');
  return {
    baseUrl: `http://127.0.0.1:${addr.port}`,
    close: () =>
      new Promise<void>((resClose, rejClose) =>
        srv.close(err => (err ? rejClose(err) : resClose())),
      ),
  };
}

describe('@aklapper/db Agensi cache fallback, corpus isolation & prod seed guard', () => {
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

  it('serves cached creator skills on HTTP 503 with fallback badge and skips upstream on fresh TTL', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const handle = `fallback-${Date.now()}`;
    cleanupHandles.add(handle);
    cleanupSlugs.add('cached-live-1');
    cleanupSlugs.add('cached-live-2');

    let failUpstream = false;
    let requestCount = 0;
    const srv = await startServer((_req, res) => {
      requestCount += 1;
      if (failUpstream) {
        res.statusCode = 503;
        res.end('unavailable');
        return;
      }
      res.setHeader('content-type', 'application/json');
      res.end(
        JSON.stringify({
          items: [
            {
              slug: 'cached-live-1',
              name: 'Cached Skill 1',
              summary: 'First cached item.',
              tags: ['agents'],
              url: 'https://agensi.io/skills/cached-live-1',
              creatorHandle: handle,
              isPublished: true,
              sortOrder: 1,
            },
            {
              slug: 'cached-live-2',
              name: 'Cached Skill 2',
              summary: 'Second cached item.',
              tags: ['go'],
              url: 'https://agensi.io/skills/cached-live-2',
              creatorHandle: handle,
              isPublished: true,
              sortOrder: 2,
            },
          ],
        }),
      );
    });
    closers.push(srv.close);

    // 1. Populate cache cleanly with long TTL
    const freshLoader = await loadPortalAgensiData(db, {
      correlationId: 'corr-fresh',
      env: {
        AGENSI_API_BASE_URL: srv.baseUrl,
        AGENSI_CREATOR_HANDLE: handle,
        AGENSI_CACHE_TTL_SECONDS: '300',
      },
    });
    expect(freshLoader.skills).toHaveLength(2);
    expect(freshLoader.catalogMeta?.mode).toBe('live');
    expect(freshLoader.content.statusBadge.label).toBe('Catalog live');
    expect(requestCount).toBe(1);

    // 2. Within TTL -> cache hit, 0 extra HTTP requests
    const cacheHit = await loadCreatorAgensiCatalog(db, {
      correlationId: 'corr-hit',
      env: {
        AGENSI_API_BASE_URL: srv.baseUrl,
        AGENSI_CREATOR_HANDLE: handle,
        AGENSI_CACHE_TTL_SECONDS: '300',
      },
    });
    expect(requestCount).toBe(1);
    expect(cacheHit.catalogMeta.mode).toBe('cache');

    // 3. Force expired TTL + upstream 503 -> fallback badge + preserves prior lastSyncedAt
    const [priorState] = await db
      .select()
      .from(agensiSyncState)
      .where(eq(agensiSyncState.creatorHandle, handle));
    failUpstream = true;
    const outageData = await loadPortalAgensiData(db, {
      correlationId: 'corr-outage-1',
      env: {
        AGENSI_API_BASE_URL: srv.baseUrl,
        AGENSI_CREATOR_HANDLE: handle,
        AGENSI_CACHE_TTL_SECONDS: '0',
      },
    });
    expect(outageData.skills.map(s => s.slug)).toEqual(['cached-live-1', 'cached-live-2']);
    expect(outageData.content.statusBadge.label).toBe('catalog · cached fallback');
    expect(outageData.catalogMeta?.mode).toBe('cached_fallback');

    const [afterOutageState] = await db
      .select()
      .from(agensiSyncState)
      .where(eq(agensiSyncState.creatorHandle, handle));
    expect(afterOutageState?.lastStatus).toBe('error');
    expect(afterOutageState?.lastSyncedAt?.toISOString()).toBe(
      priorState?.lastSyncedAt?.toISOString(),
    );

    const logs = infoSpy.mock.calls.map(c => String(c[0])).join('\n');
    expect(logs).toContain('RULE_DIVERGENCE');
    expect(logs).toContain('seam_decision_branch_total');
    expect(logs).toContain('stale_fallback');
    expect(logs).toContain('"fallbackUsed":true');
  });

  it('fails closed on cold-cache outage, isolates creator-scoped readers + Admin CMS, and skips AGENSI_SKILL_SEEDS in prod', async () => {
    const handle = `isolated-${Date.now()}`;
    cleanupHandles.add(handle);
    cleanupSlugs.add('pub-owner-only');
    cleanupSlugs.add('draft-owner-hidden');
    cleanupSlugs.add('foreign-published');
    cleanupSlugs.add('null-legacy-row');
    cleanupSlugs.add('prod-live-row');

    await db.insert(agensiSkills).values([
      {
        slug: 'foreign-published',
        name: 'Foreign Marketplace Skill',
        summary: 'Must never appear for owner.',
        tags: ['other'],
        url: 'https://agensi.io/skills/foreign-published',
        creatorHandle: 'rival-creator',
        isPublished: true,
        source: 'agensi_api',
        sortOrder: 1,
      },
      {
        slug: 'null-legacy-row',
        name: 'Unverified Legacy Seed',
        summary: 'Must stay hidden.',
        tags: ['legacy'],
        url: 'https://agensi.io/skills/null-legacy-row',
        creatorHandle: null,
        isPublished: false,
        source: 'seed',
        sortOrder: 2,
      },
    ]);

    // Cold-cache outage returns 0 skills without leaking foreign/unverified rows
    const coldOutage = await loadPortalAgensiData(db, {
      env: {
        AGENSI_API_BASE_URL: 'http://127.0.0.1:1',
        AGENSI_CREATOR_HANDLE: handle,
      },
    });
    expect(coldOutage.skills).toEqual([]);
    expect(coldOutage.catalogMeta?.mode).toBe('empty');

    // Insert 1 published owner + 1 draft owner
    await db.insert(agensiSkills).values([
      {
        slug: 'pub-owner-only',
        name: 'Published Owner Skill',
        summary: 'UniqueKeywordZeta.',
        tags: ['agents'],
        url: 'https://agensi.io/skills/pub-owner-only',
        creatorHandle: handle,
        isPublished: true,
        source: 'agensi_api',
        sortOrder: 1,
      },
      {
        slug: 'draft-owner-hidden',
        name: 'Draft Owner Skill',
        summary: 'UniqueKeywordZeta.',
        tags: ['draft'],
        url: 'https://agensi.io/skills/draft-owner-hidden',
        creatorHandle: handle,
        isPublished: false,
        source: 'agensi_api',
        sortOrder: 2,
      },
    ]);

    expect((await getAgensiSkills(db, handle)).map(s => s.slug)).toEqual(['pub-owner-only']);
    const cms = await loadAdminCmsData(db, { creatorHandle: handle });
    expect(cms.agensiSkills.map(s => s.slug)).toEqual(['pub-owner-only']);
    expect(cms.agensiSyncState?.lastStatus).toBe('error');
    expect(cms.agensiSyncState?.lastSyncedAt).toBeNull();

    // Production seed guard isolated inside rolled-back transaction (zero shared row contention)
    class RollbackTestSentinel extends Error {}
    await expect(
      db.transaction(async tx => {
        await tx.insert(agensiSkills).values({
          slug: 'prod-live-row',
          name: 'Live Synced Row',
          summary: 'Preserved in prod.',
          tags: ['live'],
          url: 'https://agensi.io/skills/prod-live-row',
          creatorHandle: 'aklapper',
          isPublished: true,
          source: 'agensi_api',
          sortOrder: 1,
        });
        await tx
          .delete(agensiSkills)
          .where(
            sql`slug LIKE 'cadence-%' OR slug = 'local-gpu-coprocessor-offload-for-coding-agents-fastmcp'`,
          );

        await seedDatabase(tx as unknown as AppDatabase, {
          ...process.env,
          NODE_ENV: 'production',
        });
        const afterProdSeed = await getAgensiSkills(tx as unknown as AppDatabase, 'aklapper');
        expect(afterProdSeed.map(s => s.slug)).toEqual(['prod-live-row']);
        throw new RollbackTestSentinel();
      }),
    ).rejects.toBeInstanceOf(RollbackTestSentinel);
  });

  it('prevents older timed-out sync from overwriting newer committed ok state and breaking TTL cache', async () => {
    const handle = `race-timeout-${Date.now()}`;
    cleanupHandles.add(handle);
    cleanupSlugs.add('race-timeout-fresh-skill');

    let slowReqStarted!: () => void;
    const slowReqGate = new Promise<void>(resolve => {
      slowReqStarted = resolve;
    });
    let releaseSlow!: () => void;
    const holdSlow = new Promise<void>(resolve => {
      releaseSlow = resolve;
    });

    let reqCount = 0;
    const srv = await startServer((req, res) => {
      reqCount += 1;
      if (req.headers['x-sync-mode'] === 'slow') {
        slowReqStarted();
        void holdSlow.then(() => {
          if (!res.destroyed) res.end();
        });
        return;
      }
      res.setHeader('content-type', 'application/json');
      res.end(
        JSON.stringify({
          items: [
            {
              slug: 'race-timeout-fresh-skill',
              name: 'Fresh Skill',
              summary: 'Committed concurrently while slow read was in flight.',
              tags: ['resilience'],
              url: 'https://agensi.io/skills/race-timeout-fresh-skill',
              creatorHandle: handle,
              isPublished: true,
              sortOrder: 1,
            },
          ],
        }),
      );
    });
    closers.push(srv.close);

    const baseEnv = {
      AGENSI_API_BASE_URL: srv.baseUrl,
      AGENSI_CREATOR_HANDLE: handle,
      AGENSI_CACHE_TTL_SECONDS: '300',
      AGENSI_FETCH_TIMEOUT_MS: '250',
    };

    const slowFetch: typeof fetch = (input, init) => {
      const headers = new Headers(init?.headers);
      headers.set('x-sync-mode', 'slow');
      return fetch(input, { ...init, headers });
    };

    const slowPromise = loadPortalAgensiData(db, { env: baseEnv, fetchImpl: slowFetch });
    await slowReqGate;

    await new Promise(resolve => setTimeout(resolve, 10));
    const fastSync = await syncAgensiCatalog(db, {
      forceRefresh: true,
      env: baseEnv,
      correlationId: 'fast-sync-wins',
    });
    expect(fastSync.syncState.lastStatus).toBe('ok');
    expect(fastSync.skills.map(s => s.slug)).toEqual(['race-timeout-fresh-skill']);

    const slowResult = await slowPromise;
    expect(slowResult.catalogMeta?.mode).toBe('cached_fallback');
    expect(slowResult.skills.map(s => s.slug)).toEqual(['race-timeout-fresh-skill']);
    releaseSlow();

    // Sync state committed by fastSync MUST remain 'ok' with null lastError.
    const cms = await loadAdminCmsData(db, { creatorHandle: handle });
    expect(cms.agensiSyncState?.lastStatus).toBe('ok');
    expect(cms.agensiSyncState?.lastError).toBeNull();
    expect(cms.agensiSyncState?.itemCount).toBe(1);

    // Subsequent read inside 300s TTL MUST serve PG19 cache with zero upstream fetches.
    const countBeforeCacheRead = reqCount;
    const cachedRead = await loadPortalAgensiData(db, { env: baseEnv });
    expect(cachedRead.catalogMeta?.mode).toBe('cache');
    expect(cachedRead.skills.map(s => s.slug)).toEqual(['race-timeout-fresh-skill']);
    expect(reqCount).toBe(countBeforeCacheRead);
  });
});
