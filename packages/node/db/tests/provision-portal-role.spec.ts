import {
  DEFAULT_LOCAL_PORTAL_APP_PASSWORD,
  PORTAL_APP_ROLE_NAME,
  provisionPortalRole,
  resolvePortalAppPassword,
  runProvisionPortalRoleCli,
} from '../src/index.ts';
import { registerRoleProvisionTestSuites } from './provision-role-test-harness.ts';

registerRoleProvisionTestSuites({
  suitePrefix: 'provision-portal-role',
  roleName: PORTAL_APP_ROLE_NAME,
  urlEnvVar: 'PORTAL_DATABASE_URL',
  passwordEnvVar: 'PORTAL_APP_PASSWORD',
  defaultLocalPassword: DEFAULT_LOCAL_PORTAL_APP_PASSWORD,
  logEventName: 'db.provision_portal_role.execution',
  expectedLiveFlags: {
    rolcanlogin: true,
    rolsuper: false,
    rolcreatedb: false,
    rolcreaterole: false,
    rolinherit: true,
    rolreplication: false,
    rolbypassrls: false,
  },
  ownerDatabaseUrl: process.env['TEST_DATABASE_URL'] ?? process.env['DATABASE_URL'],
  roleDatabaseUrl: process.env['PORTAL_DATABASE_URL'],
  resolvePassword: resolvePortalAppPassword,
  provisionRole: provisionPortalRole,
  runCli: runProvisionPortalRoleCli,
});
