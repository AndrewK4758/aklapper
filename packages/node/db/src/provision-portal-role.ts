import { loadWorkspaceEnv } from '@aklapper/node-runtime/env';
import type { Pool } from 'pg';

import {
  type AppRoleProvisionConfig,
  type ProvisionAppRoleOptions,
  type ProvisionAppRoleResult,
  provisionAppRole,
  resolveAppRolePassword,
  type RunProvisionAppRoleCliOptions,
  runProvisionAppRoleCli,
} from './provision-role-common.ts';

export const PORTAL_APP_ROLE_NAME = 'portal_app';
export const DEFAULT_LOCAL_PORTAL_APP_PASSWORD = 'portal_app_local_dev_password';

export type ProvisionPortalRoleResult = ProvisionAppRoleResult<typeof PORTAL_APP_ROLE_NAME>;
export type ProvisionPortalRoleOptions = ProvisionAppRoleOptions;

const PORTAL_ROLE_CONFIG: AppRoleProvisionConfig<typeof PORTAL_APP_ROLE_NAME> = {
  roleName: PORTAL_APP_ROLE_NAME,
  urlEnvVar: 'PORTAL_DATABASE_URL',
  passwordEnvVar: 'PORTAL_APP_PASSWORD',
  defaultLocalPassword: DEFAULT_LOCAL_PORTAL_APP_PASSWORD,
  gucSettingName: 'aklapper.portal_app_password',
  cliScriptName: 'db:provision-portal-role',
  logEventName: 'db.provision_portal_role.execution',
};

/**
 * Resolves the password used to provision the out-of-band PostgreSQL `portal_app` LOGIN role. Fails
 * closed in production unless `PORTAL_DATABASE_URL` or `PORTAL_APP_PASSWORD` is supplied.
 */
export function resolvePortalAppPassword(
  env: Readonly<Record<string, string | undefined>> = process.env,
): string {
  return resolveAppRolePassword(PORTAL_ROLE_CONFIG, env);
}

/**
 * Idempotently creates or updates the least-privilege PostgreSQL `portal_app` LOGIN role using a
 * transaction-local GUC parameter so credentials never appear in SQL statements or logs.
 */
export function provisionPortalRole(
  pool: Pick<Pool, 'connect'>,
  options: ProvisionPortalRoleOptions = {},
): Promise<ProvisionPortalRoleResult> {
  return provisionAppRole(PORTAL_ROLE_CONFIG, pool, options);
}

export function runProvisionPortalRoleCli(
  options: RunProvisionAppRoleCliOptions = {},
): Promise<ProvisionPortalRoleResult> {
  return runProvisionAppRoleCli(PORTAL_ROLE_CONFIG, options);
}

if (import.meta.main) {
  loadWorkspaceEnv({ startDir: import.meta.dirname });
  await runProvisionPortalRoleCli();
}
