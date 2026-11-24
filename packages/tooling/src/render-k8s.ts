import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export interface RenderK8sOptions {
  readonly projectId: string;
  readonly region: string;
  readonly garRepository: string;
  readonly imageTag: string;
  readonly imageTagsByService?: Readonly<Record<string, string>>;
  readonly replicas?: number;
  readonly gkeWorkloadSa?: string;
  readonly cloudSqlInstance?: string;
  readonly configMapName?: string;
  readonly secretName?: string;
}

const MANIFEST_FILES = [
  'base/namespaces.yaml',
  'base/quotas-limits.yaml',
  'base/network-policies.yaml',
  'portfolio-public/rbac.yaml',
  'cadence-admin/rbac.yaml',
  'portfolio-public/services.yaml',
  'cadence-admin/service.yaml',
  'base/gateway.yaml',
  'portfolio-public/deployments.yaml',
  'cadence-admin/deployment.yaml',
] as const;

const GKE_SERVICE_NAMES = [
  'k8s-watch',
  'cadence-demo',
  'ai-ask',
  'contact',
  'cadence-admin',
] as const;

const CLOUDSQL_PROXY_BLOCK_RE = /[ \t]*# cloud-sql-proxy-start[\s\S]*?# cloud-sql-proxy-end\r?\n?/g;
const CLOUDSQL_VOLUME_MOUNT_RE = /[ \t]*- name: cloudsql\r?\n[ \t]*mountPath: \/cloudsql\r?\n?/g;
const CLOUDSQL_VOLUME_BLOCK_RE =
  /^[ \t]*volumes:\r?\n[ \t]*- name: cloudsql\r?\n[ \t]*emptyDir: \{\}\r?\n?/gm;
const GKE_SA_ANNOTATION_LINE_RE =
  /^[ \t]*annotations:\r?\n[ \t]*iam\.gke\.io\/gcp-service-account:.*\r?\n?/gm;

function validateRenderOptions(options: RenderK8sOptions): {
  projectId: string;
  region: string;
  garRepository: string;
  imageTag: string;
  replicas: number;
  gkeWorkloadSa: string;
  cloudSqlInstance: string;
  configMapName: string;
  secretName: string;
} {
  const projectId = options.projectId.trim();
  const region = options.region.trim();
  const garRepository = options.garRepository.trim();
  const imageTag = options.imageTag.trim();
  const replicas = options.replicas ?? 1;

  if (!projectId || projectId === 'PROJECT_ID') {
    throw new Error('renderK8sManifests requires a concrete GCP projectId (got PROJECT_ID/empty).');
  }
  if (!region || !garRepository || !imageTag) {
    throw new Error('renderK8sManifests requires non-empty region, garRepository, and imageTag.');
  }
  if (!Number.isInteger(replicas) || replicas < 1) {
    throw new Error(`renderK8sManifests requires integer replicas >= 1 (got ${String(replicas)}).`);
  }

  return {
    projectId,
    region,
    garRepository,
    imageTag,
    replicas,
    gkeWorkloadSa: options.gkeWorkloadSa?.trim() ?? '',
    cloudSqlInstance: options.cloudSqlInstance?.trim() ?? '',
    configMapName: options.configMapName?.trim() || 'aklapper-runtime-config',
    secretName: options.secretName?.trim() || 'aklapper-runtime-secrets',
  };
}

export function renderK8sManifests(manifestsDir: string, options: RenderK8sOptions): string {
  const cfg = validateRenderOptions(options);
  const registryPrefix = `${cfg.region}-docker.pkg.dev/${cfg.projectId}/${cfg.garRepository}`;
  const chunks: string[] = [];

  for (const relPath of MANIFEST_FILES) {
    const absPath = resolve(manifestsDir, relPath);
    if (!existsSync(absPath)) {
      throw new Error(`Required Kubernetes manifest missing: ${absPath}`);
    }
    let content = readFileSync(absPath, 'utf8').trim();

    for (const service of GKE_SERVICE_NAMES) {
      const tag = options.imageTagsByService?.[service]?.trim() || cfg.imageTag;
      const imagePattern = new RegExp(
        `us-central1-docker\\.pkg\\.dev/PROJECT_ID/(?:aklapper|portfolio)/${service}:[A-Za-z0-9._-]+`,
        'g',
      );
      content = content.replace(imagePattern, `${registryPrefix}/${service}:${tag}`);
    }

    if (relPath.endsWith('deployments.yaml') || relPath.endsWith('deployment.yaml')) {
      content = content.replace(/^(\s*replicas:\s*)\d+\s*$/gm, `$1${cfg.replicas}`);
      if (cfg.configMapName !== 'aklapper-runtime-config') {
        content = content.replaceAll('aklapper-runtime-config', cfg.configMapName);
      }
      if (cfg.secretName !== 'aklapper-runtime-secrets') {
        content = content.replaceAll('aklapper-runtime-secrets', cfg.secretName);
      }

      if (cfg.cloudSqlInstance) {
        content = content.replaceAll('PROJECT_ID:us-central1:aklapper', cfg.cloudSqlInstance);
      } else {
        content = content
          .replace(CLOUDSQL_PROXY_BLOCK_RE, '')
          .replace(CLOUDSQL_VOLUME_MOUNT_RE, '')
          .replace(CLOUDSQL_VOLUME_BLOCK_RE, '');
      }
    }

    if (relPath.endsWith('rbac.yaml')) {
      if (cfg.gkeWorkloadSa) {
        content = content.replaceAll(
          'gke-workload@PROJECT_ID.iam.gserviceaccount.com',
          cfg.gkeWorkloadSa,
        );
      } else {
        content = content.replace(GKE_SA_ANNOTATION_LINE_RE, '');
      }
    }

    chunks.push(content);
  }

  const rendered = `${chunks.join('\n---\n')}\n`;
  if (rendered.includes('PROJECT_ID') || /__[A-Z0-9_]+__/.test(rendered)) {
    throw new Error(
      'Rendered Kubernetes manifests still contain unreplaced template placeholders.',
    );
  }
  return rendered;
}

function parseRenderCliArgs(argv: readonly string[]): {
  manifestsDir: string;
  options: RenderK8sOptions;
} {
  let manifestsDir = 'infra/k8s';
  let projectId = process.env['GCP_PROJECT_ID'] ?? '';
  let region = process.env['GCP_REGION'] ?? 'us-central1';
  let garRepository = process.env['GAR_REPOSITORY'] ?? 'portfolio';
  let imageTag = process.env['IMAGE_TAG'] ?? '';
  let replicas = Number(process.env['GKE_REPLICAS'] ?? '1');
  let gkeWorkloadSa = process.env['GCP_GKE_WORKLOAD_SA'] ?? '';
  let cloudSqlInstance = process.env['CLOUD_SQL_INSTANCE'] ?? '';
  const imageTagsByService: Record<string, string> = {};

  const gkeServicesRaw = process.env['GKE_SERVICES_JSON']?.trim();
  const deployAll = process.env['DEPLOY_ALL'] === 'true';
  if (gkeServicesRaw && imageTag) {
    const affected = new Set(JSON.parse(gkeServicesRaw) as string[]);
    for (const svc of GKE_SERVICE_NAMES) {
      imageTagsByService[svc] = deployAll || affected.has(svc) ? imageTag : 'production-latest';
    }
  }

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--') continue;
    const eq = token?.indexOf('=') ?? -1;
    const flag = eq > 0 ? token!.slice(0, eq) : token;
    const nextVal = eq > 0 ? token!.slice(eq + 1) : argv[i + 1];
    const consumeNext = eq <= 0;

    if (flag === '--dir') manifestsDir = nextVal ?? manifestsDir;
    else if (flag === '--project-id') projectId = nextVal ?? projectId;
    else if (flag === '--region') region = nextVal ?? region;
    else if (flag === '--gar-repository') garRepository = nextVal ?? garRepository;
    else if (flag === '--image-tag') imageTag = nextVal ?? imageTag;
    else if (flag === '--replicas') replicas = Number(nextVal ?? '1');
    else if (flag === '--gke-workload-sa') gkeWorkloadSa = nextVal ?? gkeWorkloadSa;
    else if (flag === '--cloud-sql-instance') cloudSqlInstance = nextVal ?? cloudSqlInstance;
    else throw new Error(`Unknown render-k8s option: ${String(token)}`);

    if (consumeNext) i += 1;
  }

  return {
    manifestsDir: resolve(process.cwd(), manifestsDir),
    options: {
      projectId,
      region,
      garRepository,
      imageTag,
      imageTagsByService:
        Object.keys(imageTagsByService).length > 0 ? imageTagsByService : undefined,
      replicas,
      gkeWorkloadSa: gkeWorkloadSa || undefined,
      cloudSqlInstance: cloudSqlInstance || undefined,
    },
  };
}

if (import.meta.main) {
  const { manifestsDir, options } = parseRenderCliArgs(process.argv.slice(2));
  process.stdout.write(renderK8sManifests(manifestsDir, options));
}
