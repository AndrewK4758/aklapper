import type { CadenceGateAudit, CadenceSpecArtifact } from '@aklapper/core';
import {
  buildGoldenShowcaseArtifacts,
  CADENCE_PRESET_SEEDS,
  getPrerenderGoldenSandboxRuns,
  GOLDEN_SHOWCASE_DEFINITIONS,
  GOLDEN_SHOWCASE_HTML,
  PORTAL_CADENCE_SEED,
} from '@aklapper/core/prerender';

import { computeCadencePresetRevisionHash, computeCadencePromptHash } from './cadence-showcase.ts';

export { CADENCE_PRESET_SEEDS, getPrerenderGoldenSandboxRuns, PORTAL_CADENCE_SEED };

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
    const {
      artifactBytes,
      gateAudit: gateAuditJson,
      spec: specJson,
    } = buildGoldenShowcaseArtifacts(def, html);
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
