import {
  type CadenceGateAudit,
  type CadencePreset,
  type CadenceRunResult,
  type CadenceSpecArtifact,
  type PortalCadenceContent,
  PortalCadenceContentSchema,
} from '@aklapper/core';

import { computeCadencePresetRevisionHash, computeCadencePromptHash } from './cadence-showcase.ts';
import { GOLDEN_SHOWCASE_HTML } from './seed-golden-html.ts';

export const PORTAL_CADENCE_SEED: PortalCadenceContent = PortalCadenceContentSchema.parse({
  windowTitle: 'CADENCE Builder — Interactive Multi-Artifact Showcase',
  statusBadge: {
    source: 'svc-cadence-demo',
    state: 'idle',
    label: 'On-demand',
  },
  description:
    'Inspect verified CADENCE methodology showcases at zero cost or run custom prompts through live CHORD specification, streaming build, and security gate pipelines.',
  iframeTitle: 'CADENCE Artifact Preview',
});

const GOLDEN_SHOWCASE_DEFINITIONS = [
  {
    id: '00000000-0000-4000-8000-000000000101',
    slug: 'chord-decomposition-workbench',
    title: 'CHORD Behavioral Decomposition Workbench',
    expectedKind: 'chord-workbench',
    sortOrder: 1,
    starterPrompt:
      'Build an interactive CHORD Behavioral Decomposition Workbench showing Conditions, Handling, Outcomes, Rules, Deltas, observability seams, and Gherkin verification scenarios.',
    spec: {
      title: 'CHORD Behavioral Decomposition Workbench',
      summary:
        'Structured 5-axis CHORD decomposition linking behavioral contracts, observability seams, and Gherkin BDD scenarios.',
      conditions: [
        'Every feature acceptance criterion enters with explicit preconditions, auth scope, and edge-case boundaries.',
        'Unknown or unverified codebase assumptions halt at Gate 1 before implementation.',
      ],
      handling: [
        'Decompose each AC into Conditions, Handling, Outcomes, Rules, and Deltas.',
        'Bind each Rule and Delta to an executable observability seam and Gherkin scenario.',
      ],
      outcomes: [
        'Reviewers verify behavior deterministically across API, DB, and UI surfaces.',
        'Zero unstated side effects or silent fallbacks ship to production.',
      ],
      rules: [
        'Security Boundary Posture outranks Structural Simplicity on every trade-off.',
        'All artifacts render inside sandbox="allow-scripts" with strict SHA-256 CSP.',
      ],
      deltas: [
        'Persists structured spec_json and gate_audit_json alongside sanitized artifact_html.',
        'Zero LLM spend or quota debit on Golden Showcase inspection.',
      ],
      recalledPatterns: ['CHORD 5-Axis Spec', 'Observability Seams', 'BDD Red-Green-Refactor'],
    },
    gateAudit: {
      summary: 'Verified Golden Showcase — strict SHA-256 CSP and zero unsafe script vectors.',
      sanitized: false,
      checks: [
        {
          id: 'csp-sha256',
          label: 'Strict SHA-256 CSP Meta',
          status: 'pass' as const,
          detail:
            'default-src none; script-src sha256-pinned probe only; zero unsafe-inline scripts.',
        },
        {
          id: 'iframe-sandbox',
          label: 'Opaque Iframe Isolation',
          status: 'pass' as const,
          detail: 'Rendered with sandbox="allow-scripts" and referrerPolicy="no-referrer".',
        },
        {
          id: 'chord-completeness',
          label: '5-Axis CHORD Completeness',
          status: 'pass' as const,
          detail: 'Conditions, Handling, Outcomes, Rules, and Deltas all verified.',
        },
      ],
    },
  },
  {
    id: '00000000-0000-4000-8000-000000000102',
    slug: 'change-tier-gate-matrix',
    title: 'Change-Tier Blast-Radius & Gate Matrix',
    expectedKind: 'tier-gate-matrix',
    sortOrder: 2,
    starterPrompt:
      'Build an interactive Change-Tier Blast-Radius & Gate Matrix comparing Trivial, Low, Medium, and High tiers across Gates 1 through 4.',
    spec: {
      title: 'Change-Tier Blast-Radius & Gate Matrix',
      summary:
        'Classifies engineering changes into Trivial, Low, Medium, or High tiers and enforces proportional approval gates.',
      conditions: [
        'Triage evaluates bounded-context crossings, database migrations, security boundaries, and multi-service rollout needs.',
      ],
      handling: [
        'Assign highest triggered tier without downgrading when multiple risk axes fire.',
        'Require explicit human sign-off at each active gate before advancing phases.',
      ],
      outcomes: [
        'Low-risk changes stay fast while cross-service schema or security changes receive full adversarial review.',
      ],
      rules: [
        'Never skip Gate 1 Open Question rulings on High-tier tickets.',
        'Record immutable decision log entries for every gate outcome.',
      ],
      deltas: ['Zero runtime DB mutation; pure read-only methodology reference artifact.'],
      recalledPatterns: [
        'Proportional Governance',
        '4-Gate Approval Lifecycle',
        'Blast-Radius Triage',
      ],
    },
    gateAudit: {
      summary: 'Verified Golden Showcase — proportional tier matrix and strict sandbox isolation.',
      sanitized: false,
      checks: [
        {
          id: 'csp-sha256',
          label: 'Strict SHA-256 CSP Meta',
          status: 'pass' as const,
          detail: 'Zero inline script escape hatches; pure-CSS radio tabs.',
        },
        {
          id: 'tier-coverage',
          label: 'All 4 Tiers & Gates Mapped',
          status: 'pass' as const,
          detail: 'Trivial, Low, Medium, and High tiers mapped across Gates 1–4.',
        },
      ],
    },
  },
  {
    id: '00000000-0000-4000-8000-000000000103',
    slug: 'expand-contract-migration',
    title: 'Expand/Contract Zero-Downtime Migration Blueprint',
    expectedKind: 'expand-contract-migration',
    sortOrder: 3,
    starterPrompt:
      'Build an interactive Expand/Contract Zero-Downtime Migration Blueprint verifying 3-phase rolling compatibility and reversible rollback safety.',
    spec: {
      title: 'Expand/Contract Zero-Downtime Migration Blueprint',
      summary:
        'Verifies additive schema expansion, rolling pod compatibility, and reversible down-migration hygiene on ephemeral PG19.',
      conditions: [
        'Production revisions roll sequentially across Cloud Run services while sharing one PostgreSQL 19 schema.',
      ],
      handling: [
        'Use additive nullable or defaulted columns in Expand phase with idempotent SQL guards.',
        'Execute apply -> seed -> rollback -> reapply -> bootstrap on disposable ephemeral PG19.',
      ],
      outcomes: [
        'Old and new pods coexist cleanly during deployment and rollback preserves all visitor data.',
      ],
      rules: [
        'Never mutate live dev databases during automated tests.',
        'Down migration cleans dependent seeded rows before dropping constraints or columns.',
      ],
      deltas: ['Demonstrates reversible DDL expansion and rollback verification invariants.'],
      recalledPatterns: ['Expand/Contract DDL', 'Ephemeral PG19 Testing', 'Rolling Compatibility'],
    },
    gateAudit: {
      summary: 'Verified Golden Showcase — zero-downtime migration invariants validated.',
      sanitized: false,
      checks: [
        {
          id: 'csp-sha256',
          label: 'Strict SHA-256 CSP Meta',
          status: 'pass' as const,
          detail: 'Pure HTML5/CSS interactive blueprint with pinned probe script.',
        },
        {
          id: 'rollback-hygiene',
          label: 'Reversible Down-SQL Contract',
          status: 'pass' as const,
          detail: 'Verifies clean apply -> rollback -> reapply without orphan rows.',
        },
      ],
    },
  },
  {
    id: '00000000-0000-4000-8000-000000000104',
    slug: 'five-boundary-resilience-audit',
    title: '5-Boundary Resilience & Chaos Audit',
    expectedKind: 'resilience-chaos-audit',
    sortOrder: 4,
    starterPrompt:
      'Build an interactive 5-Boundary Resilience & Chaos Audit walking through fault-injection boundaries, lock ordering, and coupled-tuple atomicity.',
    spec: {
      title: '5-Boundary Resilience & Chaos Audit',
      summary:
        'Audits caller state resets, post-commit ambiguity, lock ordering, temporal cache asymmetry, and coupled-tuple atomicity.',
      conditions: [
        'Distributed requests span Cloud Run SSR, Cloud Run Go microservices, PostgreSQL 19, Qdrant, and streaming LLM providers.',
      ],
      handling: [
        'Enforce strict FOR UPDATE lock ordering across sandbox_runs and rate_limit_buckets.',
        'Cap server JSON buffers at 96 KiB and abort fail-closed on built-in secret detection.',
      ],
      outcomes: [
        'No stranded running rows, no negative quota counters, and no OOM kills inside 256Mi containers.',
      ],
      rules: [
        'Never silently fall back on privacy StreamGuard ActionAbort.',
        'Always detach terminal DB commits/refunds from cancelled HTTP request contexts.',
      ],
      deltas: [
        'Verifies coupled tuple (status, turns_used, tokens_used) atomicity under race conditions.',
      ],
      recalledPatterns: [
        '5-Boundary Walk',
        'FOR UPDATE Lock Ordering',
        'Fail-Closed Privacy Guard',
      ],
    },
    gateAudit: {
      summary: 'Verified Golden Showcase — all 5 resilience boundaries and chaos profiles audited.',
      sanitized: false,
      checks: [
        {
          id: 'csp-sha256',
          label: 'Strict SHA-256 CSP Meta',
          status: 'pass' as const,
          detail: 'Sanitized interactive HTML5/CSS with zero unsafe script tags.',
        },
        {
          id: 'lock-ordering',
          label: 'Deterministic Lock Order',
          status: 'pass' as const,
          detail: 'sandbox_runs -> session bucket -> global bucket prevents deadlocks.',
        },
      ],
    },
  },
  {
    id: '00000000-0000-4000-8000-000000000105',
    slug: 'spec-challenge-proof-ledger',
    title: 'Spec Challenge & Empirical Proof Ledger',
    expectedKind: 'spec-proof-ledger',
    sortOrder: 5,
    starterPrompt:
      'Build an interactive Spec Challenge & Empirical Proof Ledger categorizing Observed, Absence, Inferred, and Unknown claims for Gate 1 falsification.',
    spec: {
      title: 'Spec Challenge & Empirical Proof Ledger',
      summary:
        'Enforces empirical evidence tagging (Observed, Absence, Inferred, Unknown) and automated certainty gating prior to Gate 1.',
      conditions: [
        'Every architectural claim references live repository files, schemas, or tool output rather than memory.',
      ],
      handling: [
        'Run automated fact verification against the target worktree before presenting Gate 1.',
        'Convert any unverified policy or design trade-off into an explicit numbered Open Question.',
      ],
      outcomes: [
        'Implementation begins with verified schemas, sibling contracts, and zero hidden drift.',
      ],
      rules: [
        'Never silently assume operator intent when competing trade-offs exist.',
        'Keep target code repositories free of private governance metadata.',
      ],
      deltas: ['Provides interactive Gate 1 evidence ledger showcase with zero LLM spend.'],
      recalledPatterns: [
        'Empirical Evidence Ledger',
        'Pre-Gate-1 Spec Challenge',
        'Certainty Gate',
      ],
    },
    gateAudit: {
      summary: 'Verified Golden Showcase — empirical proof taxonomy and strict CSP verified.',
      sanitized: false,
      checks: [
        {
          id: 'csp-sha256',
          label: 'Strict SHA-256 CSP Meta',
          status: 'pass' as const,
          detail: 'Strict SHA-256 CSP meta injected; zero unsafe inline scripts.',
        },
        {
          id: 'evidence-rigor',
          label: 'Zero Unverified Claims',
          status: 'pass' as const,
          detail: 'Separates Observed, Absence, Inferred, and Unknown cleanly.',
        },
      ],
    },
  },
] as const;

export const CADENCE_PRESET_SEEDS: readonly CadencePreset[] = GOLDEN_SHOWCASE_DEFINITIONS.map(
  def => ({
    slug: def.slug,
    title: def.title,
    starterPrompt: def.starterPrompt,
    expectedKind: def.expectedKind,
    starterArtifactHtml: GOLDEN_SHOWCASE_HTML[def.slug] ?? '',
    sortOrder: def.sortOrder,
  }),
);

export interface GoldenSandboxRunSeed {
  readonly id: string;
  readonly sessionId: string;
  readonly ipHash: string;
  readonly menuSlug: string;
  readonly prompt: string;
  readonly status: 'ready';
  readonly gateVerdict: 'approved';
  readonly tokensIn: 0;
  readonly tokensOut: 0;
  readonly artifactHtml: string;
  readonly isGolden: true;
  readonly promptHash: string;
  readonly executionMode: 'golden';
  readonly specJson: CadenceSpecArtifact;
  readonly gateAuditJson: CadenceGateAudit;
  readonly turns: ReadonlyArray<{
    readonly phase: 'triage' | 'spec' | 'build' | 'gate';
    readonly agentName: string;
    readonly status: 'completed';
    readonly latencyMs: number;
    readonly payloadJson: Record<string, unknown>;
  }>;
}

export const CADENCE_GOLDEN_RUN_SEEDS: readonly GoldenSandboxRunSeed[] =
  GOLDEN_SHOWCASE_DEFINITIONS.map(def => {
    const html = GOLDEN_SHOWCASE_HTML[def.slug] ?? '';
    const presetRevisionHash = computeCadencePresetRevisionHash(def.expectedKind, html);
    const promptHash = computeCadencePromptHash({
      presetSlug: def.slug,
      presetRevisionHash,
      mode: 'llm',
      prompt: def.starterPrompt,
    });
    const artifactBytes = Buffer.byteLength(html, 'utf8');
    const gateAuditJson: CadenceGateAudit = {
      summary: def.gateAudit.summary,
      sanitized: def.gateAudit.sanitized,
      artifactBytes,
      checks: def.gateAudit.checks.map(c => ({ ...c })),
    };
    const specJson: CadenceSpecArtifact = {
      title: def.spec.title,
      summary: def.spec.summary,
      conditions: [...def.spec.conditions],
      handling: [...def.spec.handling],
      outcomes: [...def.spec.outcomes],
      rules: [...def.spec.rules],
      deltas: [...def.spec.deltas],
      recalledPatterns: [...def.spec.recalledPatterns],
    };
    return {
      id: def.id,
      sessionId: 'golden-showcase',
      ipHash: 'golden-seed',
      menuSlug: def.slug,
      prompt: def.starterPrompt,
      status: 'ready',
      gateVerdict: 'approved',
      tokensIn: 0,
      tokensOut: 0,
      artifactHtml: html,
      isGolden: true,
      promptHash,
      executionMode: 'golden',
      specJson,
      gateAuditJson,
      turns: [
        {
          phase: 'triage',
          agentName: 'chord-triage',
          status: 'completed',
          latencyMs: 2,
          payloadJson: {
            summary: `Classified Golden Showcase "${def.title}" (${def.expectedKind}).`,
            presetSlug: def.slug,
            mode: 'llm',
          },
        },
        {
          phase: 'spec',
          agentName: 'chord-spec',
          status: 'completed',
          latencyMs: 6,
          payloadJson: {
            summary: `Verified 5-axis CHORD specification for "${def.title}".`,
            recalledPatterns: [...def.spec.recalledPatterns],
          },
        },
        {
          phase: 'build',
          agentName: 'chord-builder',
          status: 'completed',
          latencyMs: 12,
          payloadJson: {
            summary: `Synthesized fluid Solar Forge HTML5/CSS showcase (${artifactBytes} bytes).`,
            provider: 'golden-showcase',
            artifactBytes,
          },
        },
        {
          phase: 'gate',
          agentName: 'chord-gate',
          status: 'completed',
          latencyMs: 3,
          payloadJson: {
            summary: def.gateAudit.summary,
            sanitized: def.gateAudit.sanitized,
            gateVerdict: 'approved',
            artifactBytes,
          },
        },
      ],
    };
  });

export function getPrerenderGoldenSandboxRuns(): CadenceRunResult[] {
  return CADENCE_GOLDEN_RUN_SEEDS.map(seed => ({
    runId: seed.id,
    prompt: seed.prompt,
    presetSlug: seed.menuSlug,
    runStatus: 'ready',
    mode: 'llm',
    executionMode: 'golden',
    isGolden: true,
    spec: seed.specJson,
    gateAudit: seed.gateAuditJson,
    gateVerdict: 'approved',
    turns: seed.turns.map(turn => ({
      phase: turn.phase,
      agentName: turn.agentName,
      status: turn.status,
      summary: String(turn.payloadJson['summary'] ?? ''),
      latencyMs: turn.latencyMs,
    })),
    artifactHtml: seed.artifactHtml,
    tokensIn: 0,
    tokensOut: 0,
  }));
}
