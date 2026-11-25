import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';

export interface DockerServiceSpec {
  readonly service: string;
  readonly project: string;
  readonly dockerfile: string;
  readonly runtime: 'cloud-run';
}

export const DOCKER_SERVICES: readonly DockerServiceSpec[] = [
  {
    service: 'portal',
    project: 'portal',
    dockerfile: 'apps/portal/portal/Dockerfile',
    runtime: 'cloud-run',
  },
  {
    service: 'admin',
    project: 'admin',
    dockerfile: 'apps/admin/admin/Dockerfile',
    runtime: 'cloud-run',
  },
  {
    service: 'cadence-demo',
    project: 'go-cadence-demo',
    dockerfile: 'apis/go/cadence-demo/cadence-demo/Dockerfile',
    runtime: 'cloud-run',
  },
  {
    service: 'ai-ask',
    project: 'go-ai-ask',
    dockerfile: 'apis/go/ai-ask/ai-ask/Dockerfile',
    runtime: 'cloud-run',
  },
] as const;

const PLAYWRIGHT_APP_MAP: Readonly<Record<string, string>> = {
  'portal-e2e': 'portal',
  'admin-e2e': 'admin',
};

const DB_BACKED_TEST_PROJECTS = new Set(['node-db']);
const DB_BACKED_API_E2E_PROJECTS = new Set(['go-ai-ask-e2e']);

export interface CiPlanInput {
  readonly runAll: boolean;
  readonly base?: string;
  readonly head?: string;
  readonly affectedAll: readonly string[];
  readonly lintProjects: readonly string[];
  readonly typecheckProjects: readonly string[];
  readonly buildProjects: readonly string[];
  readonly testProjects: readonly string[];
  readonly e2eProjects: readonly string[];
  readonly migrateDb?: boolean;
}

export interface CiPlanOutput {
  readonly runAll: boolean;
  readonly base: string;
  readonly head: string;
  readonly hasLint: boolean;
  readonly hasTypecheck: boolean;
  readonly hasBuild: boolean;
  readonly hasTest: boolean;
  readonly hasApiE2e: boolean;
  readonly hasPlaywright: boolean;
  readonly hasDocker: boolean;
  readonly hasDbMigration: boolean;
  readonly hasAdminOrDbMigration: boolean;
  readonly needsGo: boolean;
  readonly needsTestDb: boolean;
  readonly needsApiE2eDb: boolean;
  readonly playwrightApps: readonly string[];
  readonly playwrightBuildProjects: readonly string[];
  readonly apiE2eProjects: readonly string[];
  readonly dockerServices: readonly DockerServiceSpec[];
  readonly cloudRunServices: readonly string[];
}

export function buildCiPlan(input: CiPlanInput): CiPlanOutput {
  const affectedSet = new Set(input.affectedAll);
  const playwrightApps = Object.keys(PLAYWRIGHT_APP_MAP).filter(app =>
    input.e2eProjects.includes(app),
  );
  const playwrightBuildProjects = playwrightApps
    .map(app => PLAYWRIGHT_APP_MAP[app])
    .filter((project): project is string => Boolean(project));
  const apiE2eProjects = input.e2eProjects.filter(project => !(project in PLAYWRIGHT_APP_MAP));

  const baseDockerServices = DOCKER_SERVICES.filter(spec => {
    if (input.runAll) {
      return true;
    }
    return affectedSet.has(spec.project);
  });

  const cloudRunServices = baseDockerServices.map(spec => spec.service);

  const hasDbMigration = Boolean(input.runAll || affectedSet.has('node-db'));
  const shouldBuildAdminForMigration = Boolean(input.migrateDb && hasDbMigration);
  const adminSpec = DOCKER_SERVICES.find(spec => spec.service === 'admin');
  const dockerServices =
    shouldBuildAdminForMigration &&
    adminSpec &&
    !baseDockerServices.some(spec => spec.service === 'admin')
      ? [...baseDockerServices, adminSpec]
      : baseDockerServices;
  const hasAdminOrDbMigration = dockerServices.some(spec => spec.service === 'admin');

  const needsGo = input.affectedAll.some(project => project.startsWith('go-'));
  const needsTestDb = input.testProjects.some(project => DB_BACKED_TEST_PROJECTS.has(project));
  const needsApiE2eDb = apiE2eProjects.some(project => DB_BACKED_API_E2E_PROJECTS.has(project));

  return {
    runAll: input.runAll,
    base: input.base ?? '',
    head: input.head ?? 'HEAD',
    hasLint: input.lintProjects.length > 0,
    hasTypecheck: input.typecheckProjects.length > 0,
    hasBuild: input.buildProjects.length > 0 || playwrightBuildProjects.length > 0,
    hasTest: input.testProjects.length > 0,
    hasApiE2e: apiE2eProjects.length > 0,
    hasPlaywright: playwrightApps.length > 0,
    hasDocker: dockerServices.length > 0,
    hasDbMigration,
    hasAdminOrDbMigration,
    needsGo,
    needsTestDb,
    needsApiE2eDb,
    playwrightApps,
    playwrightBuildProjects,
    apiE2eProjects,
    dockerServices,
    cloudRunServices,
  };
}

export function formatGithubOutputs(plan: CiPlanOutput): Record<string, string> {
  return {
    run_all: String(plan.runAll),
    base: plan.base,
    head: plan.head,
    has_lint: String(plan.hasLint),
    has_typecheck: String(plan.hasTypecheck),
    has_build: String(plan.hasBuild),
    has_test: String(plan.hasTest),
    has_api_e2e: String(plan.hasApiE2e),
    has_playwright: String(plan.hasPlaywright),
    has_docker: String(plan.hasDocker),
    has_db_migration: String(plan.hasDbMigration),
    has_admin_or_db_migration: String(plan.hasAdminOrDbMigration),
    needs_go: String(plan.needsGo),
    needs_test_db: String(plan.needsTestDb),
    needs_api_e2e_db: String(plan.needsApiE2eDb),
    playwright_apps_json: JSON.stringify(plan.playwrightApps),
    playwright_build_projects: plan.playwrightBuildProjects.join(','),
    api_e2e_projects: plan.apiE2eProjects.join(','),
    docker_matrix_json: JSON.stringify(plan.dockerServices),
    cloud_run_services_json: JSON.stringify(plan.cloudRunServices),
    has_cloud_run: String(plan.cloudRunServices.length > 0),
  };
}

export interface ParsedCiPlanCliArgs {
  readonly runAll: boolean;
  readonly base?: string;
  readonly head?: string;
  readonly migrateDb?: boolean;
}

export function parseCiPlanCliArgs(argv: readonly string[]): ParsedCiPlanCliArgs {
  let runAll = false;
  let base: string | undefined;
  let head: string | undefined;
  let migrateDb: boolean | undefined;

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--all') {
      runAll = true;
    } else if (token === '--base') {
      base = argv[i + 1];
      i += 1;
    } else if (token?.startsWith('--base=')) {
      base = token.slice('--base='.length);
    } else if (token === '--head') {
      head = argv[i + 1];
      i += 1;
    } else if (token?.startsWith('--head=')) {
      head = token.slice('--head='.length);
    } else if (token === '--migrate-db') {
      migrateDb = true;
    } else if (token?.startsWith('--migrate-db=')) {
      migrateDb = token.slice('--migrate-db='.length) === 'true';
    } else {
      throw new Error(`Unknown ci-plan option: ${String(token)}`);
    }
  }

  return migrateDb !== undefined ? { runAll, base, head, migrateDb } : { runAll, base, head };
}

function queryNxProjects(
  options: { runAll: boolean; base?: string; head?: string },
  target?: string,
): string[] {
  const args = ['exec', 'nx', 'show', 'projects', '--json'];
  if (!options.runAll) {
    args.push('--affected');
    if (options.base) {
      args.push(`--base=${options.base}`);
    }
    if (options.head) {
      args.push(`--head=${options.head}`);
    }
  }
  if (target) {
    args.push(`--with-target=${target}`);
  }

  const raw = execFileSync('pnpm', args, {
    encoding: 'utf8',
    env: {
      ...process.env,
      NX_DAEMON: 'false',
    },
  }).trim();

  if (!raw) {
    return [];
  }
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error(`Expected JSON array from nx show projects, got: ${raw}`);
  }
  return parsed.filter((item): item is string => typeof item === 'string');
}

function main(): void {
  const parsed = parseCiPlanCliArgs(process.argv.slice(2));
  const base = parsed.base ?? process.env['NX_BASE']?.trim() ?? '';
  const head = parsed.head ?? process.env['NX_HEAD']?.trim() ?? 'HEAD';
  const runAll = parsed.runAll || !base;

  const queryOptions = { runAll, base: base || undefined, head };
  const affectedAll = queryNxProjects(queryOptions);
  const lintProjects = queryNxProjects(queryOptions, 'lint');
  const typecheckProjects = queryNxProjects(queryOptions, 'typecheck');
  const buildProjects = queryNxProjects(queryOptions, 'build');
  const testProjects = queryNxProjects(queryOptions, 'test');
  const e2eProjects = queryNxProjects(queryOptions, 'e2e');

  const plan = buildCiPlan({
    runAll,
    base,
    head,
    affectedAll,
    lintProjects,
    typecheckProjects,
    buildProjects,
    testProjects,
    e2eProjects,
    migrateDb: parsed.migrateDb ?? process.env['INPUT_MIGRATE_DB'] === 'true',
  });

  const outputs = formatGithubOutputs(plan);
  const githubOutputPath = process.env['GITHUB_OUTPUT'];
  if (githubOutputPath) {
    const lines = Object.entries(outputs)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');
    appendFileSync(githubOutputPath, `${lines}\n`, 'utf8');
  }

  const summaryPath = process.env['GITHUB_STEP_SUMMARY'];
  if (summaryPath) {
    const summaryLines = [
      '### Nx Affected Execution Plan',
      `- **Mode:** ${plan.runAll ? 'all projects' : `affected (\`${plan.base.slice(0, 12)}\` → \`${plan.head.slice(0, 12)}\`)`}`,
      `- **Affected projects (${affectedAll.length}):** ${affectedAll.length > 0 ? affectedAll.map(p => `\`${p}\``).join(', ') : '_none_'}`,
      `- **Jobs scheduled:** lint=${plan.hasLint}, typecheck=${plan.hasTypecheck}, build=${plan.hasBuild}, test=${plan.hasTest} (pg=${plan.needsTestDb}), api-e2e=${plan.hasApiE2e} (pg=${plan.needsApiE2eDb}), playwright=${plan.playwrightApps.join(', ') || 'none'}, docker=${plan.dockerServices.map(s => s.service).join(', ') || 'none'}`,
      `- **Go toolchain required:** ${plan.needsGo}`,
      '',
    ].join('\n');
    appendFileSync(summaryPath, summaryLines, 'utf8');
  }

  console.log(JSON.stringify(plan, null, 2));
}

if (import.meta.main) {
  main();
}
