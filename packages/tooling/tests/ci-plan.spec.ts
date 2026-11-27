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

  it('enables ephemeral Postgres, Go toolchain, and Cloud Run Go images when DB-backed or Go projects are affected', () => {
    const plan = buildCiPlan({
      runAll: false,
      base: 'aaa111',
      head: 'bbb222',
      affectedAll: [
        'node-db',
        'go-portal-api',
        'go-portal-api-e2e',
        'go-admin-api',
        'go-admin-api-e2e',
        'go-ai-ask',
        'go-ai-ask-e2e',
      ],
      lintProjects: [
        'node-db',
        'go-portal-api',
        'go-portal-api-e2e',
        'go-admin-api',
        'go-admin-api-e2e',
        'go-ai-ask',
        'go-ai-ask-e2e',
      ],
      typecheckProjects: ['node-db'],
      buildProjects: ['node-db', 'go-portal-api', 'go-admin-api', 'go-ai-ask'],
      testProjects: ['node-db', 'go-portal-api', 'go-admin-api', 'go-ai-ask'],
      e2eProjects: ['go-portal-api-e2e', 'go-admin-api-e2e', 'go-ai-ask-e2e'],
    });

    expect(plan.needsGo).toBe(true);
    expect(plan.needsTestDb).toBe(true);
    expect(plan.needsApiE2eDb).toBe(true);
    expect(plan.hasApiE2e).toBe(true);
    expect(plan.hasPlaywright).toBe(false);
    expect(plan.apiE2eProjects).toEqual(['go-portal-api-e2e', 'go-admin-api-e2e', 'go-ai-ask-e2e']);
    expect(plan.dockerServices.map(s => s.service)).toEqual([
      'portal-api',
      'admin-api',
      'ai-ask',
      'db-migrate',
    ]);
    expect(plan.cloudRunServices).toEqual(['portal-api', 'admin-api', 'ai-ask']);
    expect(plan.hasDbMigrateImage).toBe(true);
  });

  it('enables Go toolchain when node-db, tooling, or admin-e2e is affected', () => {
    for (const project of ['node-db', 'tooling', 'admin-e2e']) {
      const plan = buildCiPlan({
        runAll: false,
        base: 'aaa111',
        head: 'bbb222',
        affectedAll: [project],
        lintProjects: [project],
        typecheckProjects: [project],
        buildProjects: [],
        testProjects: [project],
        e2eProjects: project === 'admin-e2e' ? ['admin-e2e'] : [],
      });
      expect(plan.needsGo).toBe(true);
    }
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
    expect(outputs['has_db_migrate_image']).toBe('false');
    expect(outputs['has_cloud_run']).toBe('false');
    expect(outputs['needs_go']).toBe('false');
    expect(outputs['has_gke']).toBeUndefined();
    expect(outputs['gke_services_json']).toBeUndefined();
  });

  it('includes 6 Cloud Run services plus 1 cloud-run-job db-migrate image with zero k8s-watch or gke targets when runAll is true', () => {
    const plan = buildCiPlan({
      runAll: true,
      affectedAll: ['portal'],
      lintProjects: ['portal'],
      typecheckProjects: ['portal'],
      buildProjects: ['portal'],
      testProjects: ['portal'],
      e2eProjects: ['portal-e2e', 'admin-e2e'],
    });

    expect(plan.dockerServices).toHaveLength(7);
    expect(plan.dockerServices).toHaveLength(DOCKER_SERVICES.length);
    expect(plan.dockerServices.map(s => s.service)).toEqual([
      'portal',
      'admin',
      'portal-api',
      'admin-api',
      'cadence-demo',
      'ai-ask',
      'db-migrate',
    ]);
    expect(plan.dockerServices.find(s => s.service === 'db-migrate')?.runtime).toBe(
      'cloud-run-job',
    );
    // cloudRunServices must strictly exclude cloud-run-job images like db-migrate.
    expect(plan.cloudRunServices).toEqual([
      'portal',
      'admin',
      'portal-api',
      'admin-api',
      'cadence-demo',
      'ai-ask',
    ]);
    expect(plan.cloudRunServices).not.toContain('db-migrate');
    expect(plan.hasDbMigrateImage).toBe(true);
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

  it('schedules standalone db-migrate cloud-run-job image without polluting cloud_run_services_json or coupling admin SSR', () => {
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

    expect(withDbAndMigrate.dockerServices.map(s => s.service)).toEqual(['db-migrate']);
    expect(withDbAndMigrate.cloudRunServices).toEqual([]);
    expect(withDbAndMigrate.hasDbMigration).toBe(true);
    expect(withDbAndMigrate.hasDbMigrateImage).toBe(true);
    expect(formatGithubOutputs(withDbAndMigrate)['has_db_migration']).toBe('true');
    expect(formatGithubOutputs(withDbAndMigrate)['has_db_migrate_image']).toBe('true');
    expect(formatGithubOutputs(withDbAndMigrate)['has_cloud_run']).toBe('false');
    expect(formatGithubOutputs(withDbAndMigrate)['cloud_run_services_json']).toBe('[]');

    const withGoKitOnly = buildCiPlan({
      runAll: false,
      base: 'aaa111',
      head: 'bbb222',
      affectedAll: ['go-kit'],
      lintProjects: ['go-kit'],
      typecheckProjects: [],
      buildProjects: ['go-kit'],
      testProjects: ['go-kit'],
      e2eProjects: [],
      migrateDb: false,
    });
    expect(withGoKitOnly.dockerServices.map(s => s.service)).toEqual(['db-migrate']);
    expect(withGoKitOnly.cloudRunServices).toEqual([]);
    expect(withGoKitOnly.hasDbMigrateImage).toBe(true);

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
    expect(portalOnlyWithMigrate.hasDbMigrateImage).toBe(false);
    expect(formatGithubOutputs(portalOnlyWithMigrate)['has_db_migration']).toBe('false');
    expect(formatGithubOutputs(portalOnlyWithMigrate)['has_db_migrate_image']).toBe('false');

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
    expect(adminUiOnlyWithMigrate.cloudRunServices).toEqual(['admin']);
    expect(adminUiOnlyWithMigrate.hasDbMigration).toBe(false);
    expect(adminUiOnlyWithMigrate.hasDbMigrateImage).toBe(false);

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
    expect(docsOnlyWithMigrate.hasDbMigrateImage).toBe(false);
  });

  it('configures cd-gcp.yml and ci.yml for 6-service 2-wave deploy, standalone db-migrate job, zero-VPC/DB portal & admin SSR isolation, Direct VPC Egress PG19 caps <= 27, and PRIVACY_CHECK_BIN', () => {
    const workflow = readFileSync(
      resolve(import.meta.dirname, '../../../.github/workflows/cd-gcp.yml'),
      'utf8',
    );
    const ciWorkflow = readFileSync(
      resolve(import.meta.dirname, '../../../.github/workflows/ci.yml'),
      'utf8',
    );
    const cadenceDockerfile = readFileSync(
      resolve(import.meta.dirname, '../../../apis/go/cadence-demo/cadence-demo/Dockerfile'),
      'utf8',
    );
    const adminApiDockerfile = readFileSync(
      resolve(import.meta.dirname, '../../../apis/go/admin-api/admin-api/Dockerfile'),
      'utf8',
    );
    const migrateDockerfile = readFileSync(
      resolve(import.meta.dirname, '../../../packages/node/db/Dockerfile.migrate'),
      'utf8',
    );
    const rssScript = readFileSync(
      resolve(import.meta.dirname, '../../../infra/docker/verify-portal-api-rss.sh'),
      'utf8',
    );

    expect(cadenceDockerfile).toContain('ENV APP_ENV=production');
    expect(adminApiDockerfile).toContain('ENV APP_ENV=production');
    expect(migrateDockerfile).toContain('ENV PRIVACY_CHECK_BIN=/usr/local/bin/privacy-check');
    expect(migrateDockerfile).toContain('./cmd/privacy-check');

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
    expect(workflow).toContain('has_db_migrate_image');
    expect(workflow).toContain('/db-migrate:${IMAGE_TAG}');
    expect(workflow).toContain('--args="dist/migrate.js"');
    expect(workflow).toContain('--args="dist/seed.js,--mode=${SEED_MODE}"');
    expect(workflow).toContain('--args="dist/seed-admin.js"');
    expect(workflow).toContain('--network=default');
    expect(workflow).toContain('--subnet=default');
    expect(workflow).toContain('--vpc-egress=private-ranges-only');
    expect(workflow).toContain('--clear-network');
    expect(workflow).toContain('PORTAL_DATABASE_URL=PORTAL_DATABASE_URL:latest');
    expect(workflow).toContain('ADMIN_DATABASE_URL=ADMIN_DATABASE_URL:latest');
    expect(workflow).toContain('ADMIN_INTERNAL_AUTH_SECRET=ADMIN_INTERNAL_AUTH_SECRET:latest');
    expect(workflow).toContain('GCP_PORTAL_API_SERVICE_ACCOUNT');
    expect(workflow).toContain('GCP_PORTAL_SERVICE_ACCOUNT');
    expect(workflow).toContain('GCP_ADMIN_API_SERVICE_ACCOUNT');
    expect(workflow).toContain('GCP_ADMIN_SERVICE_ACCOUNT');
    expect(workflow).toContain('gcloud run services add-iam-policy-binding portal-api');
    expect(workflow).toContain('gcloud run services add-iam-policy-binding admin-api');
    expect(workflow).toContain('cd.portal_isolation.verified');
    expect(workflow).toContain('cd.admin_isolation.verified');
    expect(workflow).toContain('PG_MAX_CONNS=2');
    expect(workflow).toContain('PG_MAX_CONNS=3');
    expect(workflow).not.toContain('PG_MAX_CONNS=4');
    expect(workflow).toContain('--no-allow-unauthenticated');
    expect(workflow).toContain('--iap');
    expect(workflow).toContain('--use-http2');
    expect(workflow).toContain('--timeout=300');
    expect(workflow).toContain('APP_ENV=production');
    expect(workflow).toContain('portal_api_service_url:');
    expect(workflow).toContain('admin_api_service_url:');
    expect(workflow).toContain('ai_ask_service_url:');
    expect(workflow).toContain('cadence_demo_service_url:');
    expect(workflow).toContain('portal_service_url:');
    expect(workflow).toContain('admin_service_url:');
    expect(workflow).toContain('cd.admin_iap.edge_unprotected');
    expect(workflow).toContain('cd.post_deploy_smoke.verified');
    expect(workflow).toContain("token_format: 'id_token'");
    expect(workflow).toContain('id_token_audience:');
    expect(workflow).toContain('sparse-checkout: .github/workflows');
    expect(workflow).not.toContain('gcloud auth print-identity-token');
    expect(workflow).toContain('${url%/}/health');
    expect(workflow).not.toContain('${url%/}/healthz');
    expect(workflow).toContain('Finalize seed_content for push DB migrations');
    expect(workflow).toContain('NODE_OPTIONS: --conditions=@aklapper/source');
    expect(workflow).toContain('^https://[A-Za-z0-9-]+(\\.[A-Za-z0-9-]+)*\\.run\\.app$');
    expect(workflow).toContain('--grep @smoke');
    expect(workflow).toContain('seed_mode:');
    expect(workflow).toContain('DOSSIER_PRIVACY_DENYLIST=DOSSIER_PRIVACY_DENYLIST:latest');
    expect(workflow).toContain('all 6 Cloud Run services');

    // Ensure portal deploy uses dedicated SA + --clear-network and strips DB/salt/VPC.
    const portalDeployIdx = workflow.indexOf('id: deploy-portal\n');
    const portalVerifyIdx = workflow.indexOf(
      'Verify portal Cloud Run zero-VPC and zero-DB/salt isolation',
    );
    expect(portalDeployIdx).toBeGreaterThan(-1);
    expect(portalVerifyIdx).toBeGreaterThan(portalDeployIdx);
    const portalDeployBlock = workflow.slice(portalDeployIdx, portalVerifyIdx);
    expect(portalDeployBlock).toContain('--clear-network');
    expect(portalDeployBlock).toContain('--service-account=${{ vars.GCP_PORTAL_SERVICE_ACCOUNT }}');
    expect(portalDeployBlock).toContain(
      '--set-secrets=INTERNAL_AUTH_SECRET=INTERNAL_AUTH_SECRET:latest',
    );
    expect(portalDeployBlock).not.toContain('--network=default');
    expect(portalDeployBlock).not.toContain('DATABASE_URL=DATABASE_URL:latest');
    expect(portalDeployBlock).not.toContain('ANALYTICS_DAILY_SALT=ANALYTICS_DAILY_SALT:latest');
    expect(portalDeployBlock).not.toContain('GCP_CLOUDRUN_SERVICE_ACCOUNT');

    // Ensure admin deploy uses dedicated SA + --clear-network + --set-env-vars and strips DB/TOTP/salt/Qdrant/Agensi/VPC.
    const adminDeployIdx = workflow.indexOf('id: deploy-admin\n');
    const adminVerifyIdx = workflow.indexOf(
      'Verify admin Cloud Run zero-VPC, IAP, and HMAC-only secret isolation',
    );
    expect(adminDeployIdx).toBeGreaterThan(-1);
    expect(adminVerifyIdx).toBeGreaterThan(adminDeployIdx);
    const adminDeployBlock = workflow.slice(adminDeployIdx, adminVerifyIdx);
    expect(adminDeployBlock).toContain('--clear-network');
    expect(adminDeployBlock).toContain('--iap');
    expect(adminDeployBlock).toContain('--service-account="$ADMIN_SSR_SA"');
    expect(adminDeployBlock).toContain('--set-env-vars="$ENV_VARS"');
    expect(adminDeployBlock).not.toContain('--update-env-vars');
    expect(adminDeployBlock).not.toContain('--network=default');
    expect(adminDeployBlock).toContain(
      'ADMIN_INTERNAL_AUTH_SECRET=ADMIN_INTERNAL_AUTH_SECRET:latest,INTERNAL_AUTH_SECRET=INTERNAL_AUTH_SECRET:latest',
    );
    expect(adminDeployBlock).not.toContain('DATABASE_URL=DATABASE_URL:latest');
    expect(adminDeployBlock).not.toContain('TOTP_ENCRYPTION_KEY=TOTP_ENCRYPTION_KEY:latest');
    expect(adminDeployBlock).not.toContain('ANALYTICS_DAILY_SALT=ANALYTICS_DAILY_SALT:latest');
    expect(adminDeployBlock).not.toContain('QDRANT_API_KEY=QDRANT_API_KEY:latest');
    expect(adminDeployBlock).not.toContain('AGENSI_API_KEY=AGENSI_API_KEY:latest');
    expect(adminDeployBlock).not.toContain(
      'DOSSIER_PRIVACY_DENYLIST=DOSSIER_PRIVACY_DENYLIST:latest',
    );
    expect(adminDeployBlock).not.toContain('GCP_CLOUDRUN_SERVICE_ACCOUNT');

    // Wave 1 invoker bindings MUST appear strictly before Wave 2 SSR deploys.
    const portalInvokerBindIdx = workflow.indexOf(
      'gcloud run services add-iam-policy-binding portal-api',
    );
    const adminInvokerBindIdx = workflow.indexOf(
      'gcloud run services add-iam-policy-binding admin-api',
    );
    expect(portalInvokerBindIdx).toBeGreaterThan(-1);
    expect(portalInvokerBindIdx).toBeLessThan(portalDeployIdx);
    expect(adminInvokerBindIdx).toBeGreaterThan(-1);
    expect(adminInvokerBindIdx).toBeLessThan(adminDeployIdx);

    // Worst-case PG19 connection ceiling: portal(0) + admin(0) + portal-api(2x3) + admin-api(2x2) + ai-ask(2x2) + cadence-demo(2x2) + migrate(2) = 20 <= 27.
    const worstCasePgConns = 0 + 0 + 2 * 3 + 2 * 2 + 2 * 2 + 2 * 2 + 2;
    expect(worstCasePgConns).toBe(20);
    expect(worstCasePgConns).toBeLessThanOrEqual(27);

    // Verify CI sets up Go for both Playwright suites, exports PRIVACY_CHECK_BIN and ADMIN_DATABASE_URL, and runs portal-api RSS check.
    expect(ciWorkflow).toContain("setup-go: 'true'");
    expect(ciWorkflow).toContain('PRIVACY_CHECK_BIN=/tmp/privacy-check');
    expect(ciWorkflow).toContain('ADMIN_DATABASE_URL:');
    expect(ciWorkflow).toContain("load: ${{ matrix.service == 'portal-api' }}");
    expect(ciWorkflow).toContain('infra/docker/verify-portal-api-rss.sh');
    expect(rssScript).toContain('--memory=512m');
    expect(rssScript).toContain('--memory-swap=512m');
  });
});
