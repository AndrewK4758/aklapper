import type { CadenceGateAudit, CadenceSpecArtifact } from '../cadence-artifacts.ts';
import type { CadenceRunResult } from '../portal.ts';
import { GOLDEN_SHOWCASE_DEFINITIONS } from './prerender-golden-defs.ts';
import { GOLDEN_SHOWCASE_HTML } from './prerender-golden-html.ts';

const utf8Encoder = new TextEncoder();

export interface GoldenShowcaseArtifacts {
  readonly artifactBytes: number;
  readonly gateAudit: CadenceGateAudit;
  readonly spec: CadenceSpecArtifact;
}

export function buildGoldenShowcaseArtifacts(
  def: (typeof GOLDEN_SHOWCASE_DEFINITIONS)[number],
  html: string,
): GoldenShowcaseArtifacts {
  const artifactBytes = utf8Encoder.encode(html).byteLength;
  const gateAudit: CadenceGateAudit = {
    summary: def.gateAudit.summary,
    sanitized: def.gateAudit.sanitized,
    artifactBytes,
    checks: def.gateAudit.checks.map(c => ({ ...c })),
  };
  const spec: CadenceSpecArtifact = {
    title: def.spec.title,
    summary: def.spec.summary,
    conditions: [...def.spec.conditions],
    handling: [...def.spec.handling],
    outcomes: [...def.spec.outcomes],
    rules: [...def.spec.rules],
    deltas: [...def.spec.deltas],
    recalledPatterns: [...def.spec.recalledPatterns],
  };
  return { artifactBytes, gateAudit, spec };
}

export function getPrerenderGoldenSandboxRuns(): CadenceRunResult[] {
  return GOLDEN_SHOWCASE_DEFINITIONS.map(def => {
    const html = GOLDEN_SHOWCASE_HTML[def.slug] ?? '';
    const { artifactBytes, gateAudit, spec } = buildGoldenShowcaseArtifacts(def, html);
    return {
      runId: def.id,
      prompt: def.starterPrompt,
      presetSlug: def.slug,
      runStatus: 'ready',
      mode: 'llm',
      executionMode: 'golden',
      isGolden: true,
      spec,
      gateAudit,
      gateVerdict: 'approved',
      turns: [
        {
          phase: 'triage',
          agentName: 'chord-triage',
          status: 'completed',
          summary: `Classified Golden Showcase "${def.title}" (${def.expectedKind}).`,
          latencyMs: 2,
        },
        {
          phase: 'spec',
          agentName: 'chord-spec',
          status: 'completed',
          summary: `Verified 5-axis CHORD specification for "${def.title}".`,
          latencyMs: 6,
        },
        {
          phase: 'build',
          agentName: 'chord-builder',
          status: 'completed',
          summary: `Synthesized fluid Solar Forge HTML5/CSS showcase (${artifactBytes} bytes).`,
          latencyMs: 12,
        },
        {
          phase: 'gate',
          agentName: 'chord-gate',
          status: 'completed',
          summary: def.gateAudit.summary,
          latencyMs: 3,
        },
      ],
      artifactHtml: html,
      tokensIn: 0,
      tokensOut: 0,
    };
  });
}
