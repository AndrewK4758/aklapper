import {
  migrateAndSeedPostgres,
  resolvePortalDatabaseUrl,
  resolveWorkspaceRootOrThrow,
  shouldReuseExternalDatabase,
  startEphemeralPostgres,
} from './pg-test-container.ts';

export default async function setupEphemeralPostgresForVitest(): Promise<() => Promise<void>> {
  if (shouldReuseExternalDatabase(process.env)) {
    const existingUrl = process.env['TEST_DATABASE_URL'] ?? process.env['DATABASE_URL'];
    if (existingUrl) {
      process.env['DATABASE_URL'] = existingUrl;
      process.env['TEST_DATABASE_URL'] = existingUrl;
      const resolvedPortalUrl = resolvePortalDatabaseUrl({
        ...process.env,
        DATABASE_URL: existingUrl,
      });
      if (resolvedPortalUrl) {
        process.env['PORTAL_DATABASE_URL'] = resolvedPortalUrl;
      }
    }
    return async () => {};
  }

  const label = process.env['AKLAPPER_EPHEMERAL_PG_LABEL']?.trim() || 'vitest';
  const handle = await startEphemeralPostgres({ label });
  let cleanedUp = false;

  const teardown = async (): Promise<void> => {
    if (cleanedUp) {
      return;
    }
    cleanedUp = true;
    await handle.stop();
  };

  try {
    await migrateAndSeedPostgres(
      handle.databaseUrl,
      resolveWorkspaceRootOrThrow(),
      handle.portalDatabaseUrl,
    );
  } catch (error) {
    await teardown();
    throw error;
  }

  process.env['DATABASE_URL'] = handle.databaseUrl;
  process.env['TEST_DATABASE_URL'] = handle.databaseUrl;
  process.env['E2E_DATABASE_URL'] = handle.databaseUrl;
  process.env['PORTAL_DATABASE_URL'] = handle.portalDatabaseUrl;
  process.env['AKLAPPER_EPHEMERAL_PG_ACTIVE'] = '1';

  return teardown;
}
