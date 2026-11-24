import { resolve } from 'node:path';

import { loadWorkspaceEnv } from '@aklapper/node-runtime/env';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

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

if (import.meta.main) {
  loadWorkspaceEnv({ startDir: import.meta.dirname });
  const pool = createDbPool();
  try {
    const db = createDb(pool);
    await runMigrations(db);
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
    await pool.end();
  }
}
