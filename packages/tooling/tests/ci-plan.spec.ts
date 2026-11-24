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
    expect(plan.gkeServices).toEqual([]);
  });

  it('enables ephemeral Postgres when DB-backed unit or API E2E tests are affected', () => {
    const plan = buildCiPlan({
      runAll: false,
      base: 'aaa111',
      head: 'bbb222',
      affectedAll: ['node-db', 'node-api-auth', 'node-api-auth-e2e'],
      lintProjects: ['node-db', 'node-api-auth', 'node-api-auth-e2e'],
      typecheckProjects: ['node-db', 'node-api-auth', 'node-api-auth-e2e'],
      buildProjects: ['node-db', 'node-api-auth'],
      testProjects: ['node-db', 'node-api-auth'],
      e2eProjects: ['node-api-auth-e2e'],
    });

    expect(plan.needsGo).toBe(false);
    expect(plan.needsTestDb).toBe(true);
    expect(plan.needsApiE2eDb).toBe(true);
    expect(plan.hasApiE2e).toBe(true);
    expect(plan.hasPlaywright).toBe(false);
    expect(plan.apiE2eProjects).toEqual(['node-api-auth-e2e']);
    expect(plan.dockerServices.map(s => s.service)).toEqual(['node-api-auth']);
  });

  it('enables Go toolchain and GKE images when Go projects or k8s manifests change', () => {
    const plan = buildCiPlan({
      runAll: false,
      base: 'aaa111',
      head: 'bbb222',
      affectedAll: ['go-ai-ask', 'go-ai-ask-e2e'],
      lintProjects: ['go-ai-ask', 'go-ai-ask-e2e'],
      typecheckProjects: [],
      buildProjects: ['go-ai-ask'],
      testProjects: ['go-ai-ask'],
      e2eProjects: ['go-ai-ask-e2e'],
      k8sManifestsChanged: true,
    });

    expect(plan.needsGo).toBe(true);
    expect(plan.hasTypecheck).toBe(false);
    expect(plan.needsTestDb).toBe(false);
    expect(plan.needsApiE2eDb).toBe(true);
    expect(plan.hasPlaywright).toBe(false);
    expect(plan.gkeServices).toEqual([
      'k8s-watch',
      'cadence-demo',
      'ai-ask',
      'contact',
      'cadence-admin',
    ]);
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
  });

  it('includes all 9 Docker services when runAll is true and parses CLI args cleanly', () => {
    const plan = buildCiPlan({
      runAll: true,
      affectedAll: ['portal'],
      lintProjects: ['portal'],
      typecheckProjects: ['portal'],
      buildProjects: ['portal'],
      testProjects: ['portal'],
      e2eProjects: ['portal-e2e', 'admin-e2e'],
    });

    expect(plan.dockerServices).toHaveLength(DOCKER_SERVICES.length);
    expect(parseCiPlanCliArgs(['--all'])).toEqual({
      runAll: true,
      base: undefined,
      head: undefined,
    });
    expect(parseCiPlanCliArgs(['--base', 'origin/main', '--head=HEAD'])).toEqual({
      runAll: false,
      base: 'origin/main',
      head: 'HEAD',
    });
    expect(() => parseCiPlanCliArgs(['--bogus'])).toThrow(/Unknown ci-plan option/);
  });
});
