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

export const ADMIN_APP_ROLE_NAME = 'admin_app';
export const DEFAULT_LOCAL_ADMIN_APP_PASSWORD = 'admin_app_local_dev_password';

export type ProvisionAdminRoleResult = ProvisionAppRoleResult<typeof ADMIN_APP_ROLE_NAME>;
export type ProvisionAdminRoleOptions = ProvisionAppRoleOptions;

const ADMIN_ROLE_CONFIG: AppRoleProvisionConfig<typeof ADMIN_APP_ROLE_NAME> = {
  roleName: ADMIN_APP_ROLE_NAME,
  urlEnvVar: 'ADMIN_DATABASE_URL',
  passwordEnvVar: 'ADMIN_APP_PASSWORD',
  defaultLocalPassword: DEFAULT_LOCAL_ADMIN_APP_PASSWORD,
  gucSettingName: 'aklapper.admin_app_password',
  cliScriptName: 'db:provision-admin-role',
  logEventName: 'db.provision_admin_role.execution',
  noInherit: true,
};

/**
 * Resolves the password used to provision the out-of-band PostgreSQL `admin_app` LOGIN role. Fails
 * closed in production unless `ADMIN_DATABASE_URL` or `ADMIN_APP_PASSWORD` is supplied.
 */
export function resolveAdminAppPassword(
  env: Readonly<Record<string, string | undefined>> = process.env,
): string {
  return resolveAppRolePassword(ADMIN_ROLE_CONFIG, env);
}

/**
 * Idempotently creates or updates the least-privilege PostgreSQL `admin_app` LOGIN role using a
 * transaction-local GUC parameter so credentials never appear in SQL statements or logs.
 */
export function provisionAdminRole(
  pool: Pick<Pool, 'connect'>,
  options: ProvisionAdminRoleOptions = {},
): Promise<ProvisionAdminRoleResult> {
  return provisionAppRole(ADMIN_ROLE_CONFIG, pool, options);
}

export function runProvisionAdminRoleCli(
  options: RunProvisionAppRoleCliOptions = {},
): Promise<ProvisionAdminRoleResult> {
  return runProvisionAppRoleCli(ADMIN_ROLE_CONFIG, options);
}

if (import.meta.main) {
  loadWorkspaceEnv({ startDir: import.meta.dirname });
  await runProvisionAdminRoleCli();
}
