import { resolve } from 'node:path';

import { loadWorkspaceEnv } from '@aklapper/node-runtime/env';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import type { Pool } from 'pg';

import { type AppDatabase, createDb, createDbPool } from './client.ts';

export function getDefaultMigrationsFolder(): string {
  return resolve(import.meta.dirname, '..', 'drizzle');
}

export async function runMigrations(
  db: AppDatabase,
  migrationsFolder = getDefaultMigrationsFolder(),
): Promise<void> {
  await migrate(db, { migrationsFolder });
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
    const db = createDb(pool);
    await runMigrations(db, options.migrationsFolder);
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
