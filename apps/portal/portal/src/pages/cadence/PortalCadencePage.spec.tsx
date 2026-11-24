import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PortalCadencePage, type PortalCadencePageProps } from './PortalCadencePage';

const SAMPLE_CONTENT = {
  windowTitle: 'CADENCE Builder // portfolio-public',
  statusBadge: {
    source: 'svc-cadence-demo',
    state: 'idle' as const,
    label: '0/1 replicas',
  },
  description: 'Quota-gated prompt builder.',
  iframeTitle: 'CADENCE Artifact Preview',
};

const SAMPLE_PRESETS = [
  {
    slug: 'solar-forge-starter',
    title: 'Solar Forge Starter',
    starterPrompt: 'Build a Solar Forge card.',
    expectedKind: 'html-sandbox',
    starterArtifactHtml: '<html><body>Starter</body></html>',
    sortOrder: 1,
  },
];

describe('PortalCadencePage', () => {
  it('submits a prompt, displays 4 CHORD turns, and triggers gate approval', () => {
    const onRunBuild = vi.fn<NonNullable<PortalCadencePageProps['onRunBuild']>>();
    const onGateVerdict = vi.fn<NonNullable<PortalCadencePageProps['onGateVerdict']>>();

    const { rerender } = render(
      <PortalCadencePage
        content={SAMPLE_CONTENT}
        presets={SAMPLE_PRESETS}
        onRunBuild={onRunBuild}
        onGateVerdict={onGateVerdict}
        onClose={vi.fn<() => void>()}
      />,
    );

    fireEvent.click(screen.getByTestId('cadence-run-submit'));
    expect(onRunBuild).toHaveBeenCalledWith({
      prompt: 'Build a Solar Forge card.',
      presetSlug: 'solar-forge-starter',
    });

    const completedRun = {
      runId: '11111111-1111-4111-8111-111111111111',
      prompt: 'Build a Solar Forge card.',
      presetSlug: 'solar-forge-starter',
      gateVerdict: 'pending' as const,
      turns: [
        {
          phase: 'triage' as const,
          agentName: 'chord-triage',
          status: 'completed' as const,
          summary: 'Triaged',
          latencyMs: 5,
        },
        {
          phase: 'spec' as const,
          agentName: 'chord-spec',
          status: 'completed' as const,
          summary: 'Specified',
          latencyMs: 7,
        },
        {
          phase: 'build' as const,
          agentName: 'chord-builder',
          status: 'completed' as const,
          summary: 'Built',
          latencyMs: 11,
        },
        {
          phase: 'gate' as const,
          agentName: 'chord-gate',
          status: 'completed' as const,
          summary: 'Gated',
          latencyMs: 4,
        },
      ],
      artifactHtml: '<html><body>Built Artifact</body></html>',
      tokensIn: 120,
      tokensOut: 400,
    };

    rerender(
      <PortalCadencePage
        content={SAMPLE_CONTENT}
        presets={SAMPLE_PRESETS}
        actionResult={{ ok: true, intent: 'run', run: completedRun }}
        onRunBuild={onRunBuild}
        onGateVerdict={onGateVerdict}
        onClose={vi.fn<() => void>()}
      />,
    );

    expect(screen.getByTestId('cadence-turn-triage')).toBeTruthy();
    expect(screen.getByTestId('cadence-turn-gate')).toBeTruthy();

    fireEvent.click(screen.getByTestId('cadence-gate-approve'));
    expect(onGateVerdict).toHaveBeenCalledWith({
      runId: completedRun.runId,
      verdict: 'approved',
    });
  });
});
