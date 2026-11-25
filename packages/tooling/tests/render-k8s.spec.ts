import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { renderK8sManifests } from '../src/index.ts';

const MANIFESTS_DIR = resolve(import.meta.dirname, '../../../infra/k8s');
const CD_WORKFLOW_PATH = resolve(import.meta.dirname, '../../../.github/workflows/cd-gcp.yml');

describe('@aklapper/tooling GKE manifest renderer', () => {
  it('renders multi-namespace manifests without PROJECT_ID placeholders, setting APP_ENV=production, Cloud SQL sidecars, RBAC, Services, Gateway, and NetworkPolicy', () => {
    const rendered = renderK8sManifests(MANIFESTS_DIR, {
      projectId: 'games-424800',
      region: 'us-central1',
      garRepository: 'portfolio',
      imageTag: 'sha-abc1234',
      imageTagsByService: {
        'k8s-watch': 'sha-abc1234',
        'cadence-demo': 'production-latest',
        'ai-ask': 'sha-abc1234',
        contact: 'production-latest',
        'cadence-admin': 'sha-abc1234',
      },
      replicas: 1,
      gkeWorkloadSa: 'aklapper-gke@games-424800.iam.gserviceaccount.com',
      cloudSqlInstance: 'games-424800:us-central1:aklapper',
    });

    expect(rendered).not.toContain('PROJECT_ID');
    expect(rendered).not.toMatch(/__[A-Z0-9_]+__/);
    expect(rendered).not.toContain('replicas: 0');
    expect(rendered).toContain('replicas: 1');
    expect(rendered).toContain(
      'us-central1-docker.pkg.dev/games-424800/portfolio/ai-ask:sha-abc1234',
    );
    expect(rendered).toContain(
      'us-central1-docker.pkg.dev/games-424800/portfolio/cadence-demo:production-latest',
    );
    expect(rendered).toContain(
      'us-central1-docker.pkg.dev/games-424800/portfolio/cadence-admin:sha-abc1234',
    );
    expect(rendered).toContain('name: APP_ENV');
    expect(rendered).toContain('value: production');
    expect(rendered).toContain('name: aklapper-runtime-config');
    expect(rendered).toContain('name: aklapper-runtime-secrets');
    expect(rendered).toContain('--unix-socket=/cloudsql');
    expect(rendered).toContain('games-424800:us-central1:aklapper');
    expect(rendered).toContain('mountPath: /cloudsql');
    expect(rendered).toContain(
      'iam.gke.io/gcp-service-account: aklapper-gke@games-424800.iam.gserviceaccount.com',
    );
    expect(rendered).toContain('name: k8s-watch');
    expect(rendered).toContain('name: k8s-watch-admin-reader');
    const gatewayDoc = rendered.split('\n---\n').find(doc => doc.includes('kind: Gateway')) ?? '';
    expect(gatewayDoc).toContain('protocol: HTTPS');
    expect(gatewayDoc).toContain('name: aklapper-go-tls');
    expect(gatewayDoc).not.toMatch(/protocol:\s*HTTP\s*$/m);
    expect(gatewayDoc).not.toMatch(/port:\s*80\s*$/m);
    expect(rendered).toContain('kind: HTTPRoute');
    expect(rendered).toContain('port: 8081');
    expect(rendered).toContain('port: 8082');
    expect(rendered).toContain('port: 8083');
    expect(rendered).toContain('port: 9090');
    expect(rendered).toContain('appProtocol: kubernetes.io/h2c');
    expect(rendered).toContain('containerPort: 9090');
    expect(rendered).toContain('name: GRPC_PORT');
    expect(rendered).toContain("value: '9090'");
    expect(rendered).toContain('port: 8084');
    expect(rendered).toContain('port: 8085');
    expect(rendered).toContain('port: 443');
    expect(rendered).toContain('port: 5432');
    expect(rendered).toContain('port: 3307');
    expect(rendered).toContain('port: 53');
  });

  it('omits dangling annotations and volumes keys when optional gkeWorkloadSa and cloudSqlInstance are unset', () => {
    const rendered = renderK8sManifests(MANIFESTS_DIR, {
      projectId: 'games-424800',
      region: 'us-central1',
      garRepository: 'portfolio',
      imageTag: 'sha-abc1234',
    });

    expect(rendered).not.toContain('iam.gke.io/gcp-service-account');
    expect(rendered).not.toMatch(/^[ \t]*annotations:\s*$/m);
    expect(rendered).not.toMatch(/^[ \t]*volumes:\s*$/m);
    expect(rendered).not.toMatch(/^[ \t]*volumeMounts:\s*$/m);
    expect(rendered).not.toContain('cloud-sql-proxy');
    expect(rendered).toContain('name: k8s-watch');
    expect(rendered).toContain('name: cadence-admin');
  });

  it('rejects placeholder PROJECT_ID, empty image tags, and zero replicas', () => {
    expect(() =>
      renderK8sManifests(MANIFESTS_DIR, {
        projectId: 'PROJECT_ID',
        region: 'us-central1',
        garRepository: 'portfolio',
        imageTag: 'sha-abc1234',
      }),
    ).toThrow(/PROJECT_ID/i);

    expect(() =>
      renderK8sManifests(MANIFESTS_DIR, {
        projectId: 'games-424800',
        region: 'us-central1',
        garRepository: 'portfolio',
        imageTag: 'sha-abc1234',
        replicas: 0,
      }),
    ).toThrow(/replicas/i);
  });

  it('keeps cd-gcp.yml strictly workflow_dispatch-only and guards optional VERTEX_THINKING_BUDGET and AI_PRIVACY_DENYLIST safely', () => {
    const workflow = readFileSync(CD_WORKFLOW_PATH, 'utf8');
    expect(workflow).toMatch(/^on:\s*\n\s+workflow_dispatch:/m);
    expect(workflow).not.toMatch(/^on:\s*\n\s+(?:push|pull_request):/m);
    expect(workflow).toContain('VERTEX_THINKING_BUDGET');
    expect(workflow).toContain(
      'gcloud secrets versions describe latest --secret="AI_PRIVACY_DENYLIST"',
    );
    expect(workflow).toContain(
      '--from-file="AI_PRIVACY_DENYLIST=${tmp_secrets_dir}/AI_PRIVACY_DENYLIST"',
    );
  });
});
