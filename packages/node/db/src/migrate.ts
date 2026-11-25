import { resolve } from 'node:path';

import { loadWorkspaceEnv } from '@aklapper/node-runtime/env';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import type { Pool, PoolClient } from 'pg';

import { type AppDatabase, createDb, createDbPool } from './client.ts';

export const MIGRATION_ADVISORY_LOCK_NAME = 'aklapper_drizzle_migrations';

export function getDefaultMigrationsFolder(): string {
  return resolve(import.meta.dirname, '..', 'drizzle');
}

export async function runMigrations(
  db: AppDatabase,
  migrationsFolder = getDefaultMigrationsFolder(),
): Promise<void> {
  await migrate(db, { migrationsFolder });
}

export async function runMigrationsWithLock(
  pool: Pick<Pool, 'connect'>,
  migrationsFolder = getDefaultMigrationsFolder(),
  migrateImpl: (db: AppDatabase, folder: string) => Promise<void> = runMigrations,
): Promise<void> {
  const client: PoolClient = await pool.connect();
  let lockAcquired = false;
  let releaseWithError: Error | boolean | undefined;
  try {
    await client.query('SELECT pg_advisory_lock(hashtext($1))', [MIGRATION_ADVISORY_LOCK_NAME]);
    lockAcquired = true;
    const db = createDb(client);
    await migrateImpl(db, migrationsFolder);
  } finally {
    if (lockAcquired) {
      try {
        await client.query('SELECT pg_advisory_unlock(hashtext($1))', [
          MIGRATION_ADVISORY_LOCK_NAME,
        ]);
      } catch (unlockError) {
        releaseWithError = unlockError instanceof Error ? unlockError : true;
      }
    }
    client.release(releaseWithError);
  }
}

export async function runMigrationCli(
  options: {
    pool?: Pool;
    migrationsFolder?: string;
  } = {},
): Promise<void> {
  const ownsPool = !options.pool;
  const pool = options.pool ?? createDbPool();
  try {
    await runMigrationsWithLock(pool, options.migrationsFolder);
    console.info(
      JSON.stringify({
        event: 'db.migrate_job.execution',
        seam: 'DELTA_AUDIT_GAP',
        status: 'applied',
      }),
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        event: 'db.migrate_job.execution',
        seam: 'DELTA_AUDIT_GAP',
        status: 'failed',
        reason: error instanceof Error ? error.message : 'migration_failed',
      }),
    );
    throw error;
  } finally {
    if (ownsPool) {
      await pool.end();
    }
  }
}

if (import.meta.main) {
  loadWorkspaceEnv({ startDir: import.meta.dirname });
  await runMigrationCli();
}
