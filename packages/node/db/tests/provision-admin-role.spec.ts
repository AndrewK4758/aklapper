import {
  ADMIN_APP_ROLE_NAME,
  DEFAULT_LOCAL_ADMIN_APP_PASSWORD,
  provisionAdminRole,
  resolveAdminAppPassword,
  runProvisionAdminRoleCli,
} from '../src/index.ts';
import { registerRoleProvisionTestSuites } from './provision-role-test-harness.ts';

registerRoleProvisionTestSuites({
  suitePrefix: 'provision-admin-role',
  roleName: ADMIN_APP_ROLE_NAME,
  urlEnvVar: 'ADMIN_DATABASE_URL',
  passwordEnvVar: 'ADMIN_APP_PASSWORD',
  defaultLocalPassword: DEFAULT_LOCAL_ADMIN_APP_PASSWORD,
  logEventName: 'db.provision_admin_role.execution',
  expectedLiveFlags: {
    rolcanlogin: true,
    rolsuper: false,
    rolcreatedb: false,
    rolcreaterole: false,
    rolinherit: false,
    rolreplication: false,
    rolbypassrls: false,
  },
  ownerDatabaseUrl: process.env['TEST_DATABASE_URL'] ?? process.env['DATABASE_URL'],
  roleDatabaseUrl: process.env['ADMIN_DATABASE_URL'],
  resolvePassword: resolveAdminAppPassword,
  provisionRole: provisionAdminRole,
  runCli: runProvisionAdminRoleCli,
});
