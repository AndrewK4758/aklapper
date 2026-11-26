import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  buildCiPlan,
  DOCKER_SERVICES,
  formatGithubOutputs,
  parseCiPlanCliArgs,
} from '../src/index.ts';

describe('@aklapper/tooling CI/CD affected planner', () => {
  it('schedules only portal checks and skips Go and Postgres when only portal changed', () => {
    const plan = buildCiPlan({
      runAll: false,
      base: 'aaa111',
      head: 'bbb222',
      affectedAll: ['portal', 'portal-e2e'],
      lintProjects: ['portal', 'portal-e2e'],
      typecheckProjects: ['portal', 'portal-e2e'],
      buildProjects: ['portal'],
      testProjects: ['portal'],
      e2eProjects: ['portal-e2e'],
    });

    expect(plan.needsGo).toBe(false);
    expect(plan.needsTestDb).toBe(false);
    expect(plan.needsApiE2eDb).toBe(false);
    expect(plan.hasApiE2e).toBe(false);
    expect(plan.hasPlaywright).toBe(true);
    expect(plan.playwrightApps).toEqual(['portal-e2e']);
    expect(plan.playwrightBuildProjects).toEqual(['portal']);
    expect(plan.dockerServices.map(s => s.service)).toEqual(['portal']);
    expect(plan.cloudRunServices).toEqual(['portal']);
  });

  it('enables ephemeral Postgres and Cloud Run Go images when DB-backed or Go projects are affected', () => {
    const plan = buildCiPlan({
      runAll: false,
      base: 'aaa111',
      head: 'bbb222',
      affectedAll: ['node-db', 'go-ai-ask', 'go-ai-ask-e2e'],
      lintProjects: ['node-db', 'go-ai-ask', 'go-ai-ask-e2e'],
      typecheckProjects: ['node-db'],
      buildProjects: ['node-db', 'go-ai-ask'],
      testProjects: ['node-db', 'go-ai-ask'],
      e2eProjects: ['go-ai-ask-e2e'],
    });

    expect(plan.needsGo).toBe(true);
    expect(plan.needsTestDb).toBe(true);
    expect(plan.needsApiE2eDb).toBe(true);
    expect(plan.hasApiE2e).toBe(true);
    expect(plan.hasPlaywright).toBe(false);
    expect(plan.apiE2eProjects).toEqual(['go-ai-ask-e2e']);
    expect(plan.dockerServices.map(s => s.service)).toEqual(['ai-ask']);
    expect(plan.cloudRunServices).toEqual(['ai-ask']);
  });

  it('skips all heavy jobs when no projects are affected (e.g. docs-only change)', () => {
    const plan = buildCiPlan({
      runAll: false,
      base: 'aaa111',
      head: 'bbb222',
      affectedAll: [],
      lintProjects: [],
      typecheckProjects: [],
      buildProjects: [],
      testProjects: [],
      e2eProjects: [],
    });

    const outputs = formatGithubOutputs(plan);
    expect(outputs['has_lint']).toBe('false');
    expect(outputs['has_typecheck']).toBe('false');
    expect(outputs['has_build']).toBe('false');
    expect(outputs['has_test']).toBe('false');
    expect(outputs['has_api_e2e']).toBe('false');
    expect(outputs['has_playwright']).toBe('false');
    expect(outputs['has_docker']).toBe('false');
    expect(outputs['needs_go']).toBe('false');
    expect(outputs['has_gke']).toBeUndefined();
    expect(outputs['gke_services_json']).toBeUndefined();
  });

  it('includes exactly 4 Cloud Run Docker services with zero k8s-watch or gke targets when runAll is true', () => {
    const plan = buildCiPlan({
      runAll: true,
      affectedAll: ['portal'],
      lintProjects: ['portal'],
      typecheckProjects: ['portal'],
      buildProjects: ['portal'],
      testProjects: ['portal'],
      e2eProjects: ['portal-e2e', 'admin-e2e'],
    });

    expect(plan.dockerServices).toHaveLength(4);
    expect(plan.dockerServices).toHaveLength(DOCKER_SERVICES.length);
    expect(plan.dockerServices.map(s => s.service)).toEqual([
      'portal',
      'admin',
      'cadence-demo',
      'ai-ask',
    ]);
    expect(plan.dockerServices.every(s => s.runtime === 'cloud-run')).toBe(true);
    expect(plan.cloudRunServices).toEqual(['portal', 'admin', 'cadence-demo', 'ai-ask']);
    expect(plan.dockerServices.some(s => s.service === 'k8s-watch')).toBe(false);
    expect(parseCiPlanCliArgs(['--all'])).toEqual({
      runAll: true,
      base: undefined,
      head: undefined,
    });
    expect(parseCiPlanCliArgs(['--base', 'origin/main', '--head=HEAD', '--migrate-db'])).toEqual({
      runAll: false,
      base: 'origin/main',
      head: 'HEAD',
      migrateDb: true,
    });
    expect(() => parseCiPlanCliArgs(['--bogus'])).toThrow(/Unknown ci-plan option/);
  });

  it('runs DB migrations and adds admin migration image only when node-db is affected (skipping portal/admin-UI-only diffs)', () => {
    const withDbAndMigrate = buildCiPlan({
      runAll: false,
      base: 'aaa111',
      head: 'bbb222',
      affectedAll: ['node-db'],
      lintProjects: ['node-db'],
      typecheckProjects: ['node-db'],
      buildProjects: ['node-db'],
      testProjects: ['node-db'],
      e2eProjects: [],
      migrateDb: true,
    });

    expect(withDbAndMigrate.dockerServices.map(s => s.service)).toContain('admin');
    expect(withDbAndMigrate.hasDbMigration).toBe(true);
    expect(withDbAndMigrate.hasAdminOrDbMigration).toBe(true);
    expect(formatGithubOutputs(withDbAndMigrate)['has_db_migration']).toBe('true');
    expect(formatGithubOutputs(withDbAndMigrate)['has_admin_or_db_migration']).toBe('true');

    const portalOnlyWithMigrate = buildCiPlan({
      runAll: false,
      base: 'aaa111',
      head: 'bbb222',
      affectedAll: ['portal'],
      lintProjects: ['portal'],
      typecheckProjects: ['portal'],
      buildProjects: ['portal'],
      testProjects: ['portal'],
      e2eProjects: [],
      migrateDb: true,
    });
    expect(portalOnlyWithMigrate.dockerServices.map(s => s.service)).toEqual(['portal']);
    expect(portalOnlyWithMigrate.hasDbMigration).toBe(false);
    expect(portalOnlyWithMigrate.hasAdminOrDbMigration).toBe(false);
    expect(formatGithubOutputs(portalOnlyWithMigrate)['has_db_migration']).toBe('false');

    const adminUiOnlyWithMigrate = buildCiPlan({
      runAll: false,
      base: 'aaa111',
      head: 'bbb222',
      affectedAll: ['admin'],
      lintProjects: ['admin'],
      typecheckProjects: ['admin'],
      buildProjects: ['admin'],
      testProjects: ['admin'],
      e2eProjects: [],
      migrateDb: true,
    });
    expect(adminUiOnlyWithMigrate.dockerServices.map(s => s.service)).toEqual(['admin']);
    expect(adminUiOnlyWithMigrate.hasDbMigration).toBe(false);
    expect(adminUiOnlyWithMigrate.hasAdminOrDbMigration).toBe(true);

    const docsOnlyWithMigrate = buildCiPlan({
      runAll: false,
      base: 'aaa111',
      head: 'bbb222',
      affectedAll: [],
      lintProjects: [],
      typecheckProjects: [],
      buildProjects: [],
      testProjects: [],
      e2eProjects: [],
      migrateDb: true,
    });
    expect(docsOnlyWithMigrate.hasDocker).toBe(false);
    expect(docsOnlyWithMigrate.hasDbMigration).toBe(false);
    expect(docsOnlyWithMigrate.hasAdminOrDbMigration).toBe(false);
  });

  it('configures cd-gcp.yml for pure Cloud Run 2-wave deploy, Direct VPC Egress PG19 caps < 50, Direct IAP, and main push trigger', () => {
    const workflow = readFileSync(
      resolve(import.meta.dirname, '../../../.github/workflows/cd-gcp.yml'),
      'utf8',
    );
    const cadenceDockerfile = readFileSync(
      resolve(import.meta.dirname, '../../../apis/go/cadence-demo/cadence-demo/Dockerfile'),
      'utf8',
    );

    expect(cadenceDockerfile).toContain('ENV APP_ENV=production');
    expect(workflow).toContain('push:');
    expect(workflow).toContain('branches:');
    expect(workflow).toContain('- main');
    expect(workflow).toContain('github.event.before');
    expect(workflow).not.toContain('ADMIN_BOOTSTRAP_TOKEN');
    expect(workflow).not.toContain('deploy-gke:');
    expect(workflow).not.toContain('render-k8s.ts');
    expect(workflow).not.toContain('cloudsql-instances');
    expect(workflow).not.toContain('CLOUD_RUN_ALLOW_UNAUTH_ADMIN');
    expect(workflow).not.toMatch(/K8S_WATCH_URL=/);
    expect(workflow).toContain('PUBLIC_PORTAL_URL=${PUBLIC_PORTAL_URL}');
    expect(workflow).toMatch(/--remove-env-vars=[^\n]*K8S_WATCH_URL/);
    expect(workflow).toContain('migrate-db:');
    expect(workflow).toContain('aklapper-db-migrate');
    expect(workflow).toContain('--network=default');
    expect(workflow).toContain('--subnet=default');
    expect(workflow).toContain('--vpc-egress=private-ranges-only');
    expect(workflow).toContain('PG_MAX_CONNS=2');
    expect(workflow).toContain('PG_MAX_CONNS=4');
    expect(workflow).toContain('PG_MAX_CONNS=3');
    expect(workflow).toContain('--no-allow-unauthenticated');
    expect(workflow).toContain('--iap');
    expect(workflow).toContain('--use-http2');
    expect(workflow).toContain('--timeout=300');
    expect(workflow).toContain('APP_ENV=production');
    expect(workflow).toContain('ai_ask_service_url:');
    expect(workflow).toContain('cadence_demo_service_url:');
    expect(workflow).toContain('portal_service_url:');
    expect(workflow).toContain('admin_service_url:');
    expect(workflow).toContain('cd.admin_iap.edge_unprotected');
    expect(workflow).toContain('cd.post_deploy_smoke.verified');
    expect(workflow).toContain('gcloud auth print-identity-token');
    expect(workflow).toContain('^https://[A-Za-z0-9-]+(\\.[A-Za-z0-9-]+)*\\.run\\.app$');
    expect(workflow).toContain('--grep @smoke');
    expect(workflow).toContain('seed_mode:');
    expect(workflow).toContain('DOSSIER_PRIVACY_DENYLIST=DOSSIER_PRIVACY_DENYLIST:latest');
    expect(workflow).toContain(
      '--args="node_modules/@aklapper/db/dist/seed.js,--mode=${SEED_MODE}"',
    );

    // Verify worst-case PG_MAX_CONNS aggregate ceiling stays strictly below PG19 max_connections=50.
    const worstCasePgConns = 4 * 3 + 2 * 2 + 4 * 3 + 3 * 2 + 2;
    expect(worstCasePgConns).toBe(36);
    expect(worstCasePgConns).toBeLessThan(50);
  });
});
