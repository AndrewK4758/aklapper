import type { PoolClient } from 'pg';
import { describe, expect, it, vi } from 'vitest';

import { createDbPool } from '../src/client.ts';
import { MIGRATION_ADVISORY_LOCK_NAME, runMigrationsWithLock } from '../src/migrate.ts';

const liveDbUrl = process.env['TEST_DATABASE_URL'] ?? process.env['DATABASE_URL'];

describe('runMigrationsWithLock', () => {
  it('acquires and releases a session advisory lock on a single dedicated client', async () => {
    const events: string[] = [];
    const client = {
      query: vi.fn<(sql: string, params?: readonly unknown[]) => Promise<{ rows: unknown[] }>>(
        async (sql, params) => {
          events.push(`${sql}:${String(params?.[0] ?? '')}`);
          return { rows: [] };
        },
      ),
      release: vi.fn<() => void>(() => {
        events.push('release');
      }),
    } as unknown as PoolClient;

    await runMigrationsWithLock(
      { connect: vi.fn<() => Promise<PoolClient>>(async () => client) },
      '/tmp/migrations',
      async (_db, folder) => {
        events.push(`migrate:${folder}`);
      },
    );

    expect(events).toEqual([
      `SELECT pg_advisory_lock(hashtext($1)):${MIGRATION_ADVISORY_LOCK_NAME}`,
      'migrate:/tmp/migrations',
      `SELECT pg_advisory_unlock(hashtext($1)):${MIGRATION_ADVISORY_LOCK_NAME}`,
      'release',
    ]);
  });

  it('releases the advisory lock and client even when migration throws', async () => {
    const events: string[] = [];
    const client = {
      query: vi.fn<(sql: string) => Promise<{ rows: unknown[] }>>(async sql => {
        events.push(sql);
        return { rows: [] };
      }),
      release: vi.fn<() => void>(() => {
        events.push('release');
      }),
    } as unknown as PoolClient;

    await expect(
      runMigrationsWithLock(
        { connect: vi.fn<() => Promise<PoolClient>>(async () => client) },
        '/tmp/migrations',
        async () => {
          events.push('migrate-throw');
          throw new Error('simulated migration failure');
        },
      ),
    ).rejects.toThrow('simulated migration failure');

    expect(events).toEqual([
      'SELECT pg_advisory_lock(hashtext($1))',
      'migrate-throw',
      'SELECT pg_advisory_unlock(hashtext($1))',
      'release',
    ]);
  });

  it('destroys the pooled client when advisory unlock fails so the lock cannot leak', async () => {
    const unlockErr = new Error('connection terminated during unlock');
    const release = vi.fn<(err?: Error | boolean) => void>();
    const client = {
      query: vi.fn<(sql: string) => Promise<{ rows: unknown[] }>>(async sql => {
        if (sql.includes('pg_advisory_unlock')) {
          throw unlockErr;
        }
        return { rows: [] };
      }),
      release,
    } as unknown as PoolClient;

    await runMigrationsWithLock(
      { connect: vi.fn<() => Promise<PoolClient>>(async () => client) },
      '/tmp/migrations',
      async () => undefined,
    );

    expect(release).toHaveBeenCalledWith(unlockErr);
  });

  it.skipIf(!liveDbUrl)(
    'serializes concurrent migration invocations cleanly against live PostgreSQL 19',
    async () => {
      const pool = createDbPool(liveDbUrl);
      try {
        await Promise.all([
          runMigrationsWithLock(pool),
          runMigrationsWithLock(pool),
          runMigrationsWithLock(pool),
          runMigrationsWithLock(pool),
        ]);

        const probeClient = await pool.connect();
        try {
          const lockCheck = await probeClient.query<{ acquired: boolean }>(
            'SELECT pg_try_advisory_lock(hashtext($1)) AS acquired',
            [MIGRATION_ADVISORY_LOCK_NAME],
          );
          expect(lockCheck.rows[0]?.acquired).toBe(true);
          await probeClient.query('SELECT pg_advisory_unlock(hashtext($1))', [
            MIGRATION_ADVISORY_LOCK_NAME,
          ]);
        } finally {
          probeClient.release();
        }
      } finally {
        await pool.end();
      }
    },
  );
});
