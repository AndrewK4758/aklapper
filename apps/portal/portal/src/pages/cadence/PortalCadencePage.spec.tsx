import type { CadencePreset, CadenceRunResult } from '@aklapper/core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

const SAMPLE_PRESETS: readonly CadencePreset[] = [
  {
    slug: 'solar-forge-starter',
    title: 'Solar Forge Starter',
    starterPrompt: 'Build a Solar Forge card.',
    expectedKind: 'diagnostic-card',
    starterArtifactHtml: '<html><body>Starter Preset HTML</body></html>',
    sortOrder: 1,
  },
  {
    slug: 'k8s-pod-telemetry',
    title: 'GKE Pod Telemetry Widget',
    starterPrompt: 'Monitor GKE Autopilot scale-from-zero pods and cold wake latency.',
    expectedKind: 'pod-telemetry',
    starterArtifactHtml: '<html><body>Telemetry Preset HTML</body></html>',
    sortOrder: 2,
  },
  {
    slug: 'chord-pipeline-monitor',
    title: 'CHORD Pipeline Latency Monitor',
    starterPrompt: 'Track CHORD triage, spec, build, and gate stage durations.',
    expectedKind: 'pipeline-monitor',
    starterArtifactHtml: '<html><body>Pipeline Monitor HTML</body></html>',
    sortOrder: 3,
  },
];

describe('PortalCadencePage', () => {
  it('selects catalog presets from accessible Select dropdown, supports __custom__ prompts, and toggles fast mode', async () => {
    const user = userEvent.setup();
    const onRunBuild = vi.fn<NonNullable<PortalCadencePageProps['onRunBuild']>>();
    const onGateVerdict = vi.fn<NonNullable<PortalCadencePageProps['onGateVerdict']>>();

    render(
      <PortalCadencePage
        content={SAMPLE_CONTENT}
        presets={SAMPLE_PRESETS}
        onRunBuild={onRunBuild}
        onGateVerdict={onGateVerdict}
        onClose={vi.fn<() => void>()}
      />,
    );

    const selectTrigger = screen.getByTestId('cadence-preset-select');
    expect(selectTrigger).toBeTruthy();

    // Fast mode Switch defaults to checked ('fast').
    const fastSwitch = screen.getByTestId('cadence-fast-mode-switch');
    expect(fastSwitch.getAttribute('aria-checked')).toBe('true');

    // Open dropdown and select GKE Pod Telemetry Widget.
    await user.click(selectTrigger);
    await waitFor(() => {
      expect(selectTrigger.getAttribute('aria-expanded')).toBe('true');
    });
    const telemetryOption = await screen.findByRole('option', {
      name: /GKE Pod Telemetry Widget/i,
    });
    await user.click(telemetryOption);

    const promptInput = screen.getByTestId('cadence-prompt-input') as HTMLTextAreaElement;
    expect(promptInput.value).toBe(SAMPLE_PRESETS[1]?.starterPrompt);

    await user.click(screen.getByTestId('cadence-run-submit'));
    expect(onRunBuild).toHaveBeenLastCalledWith({
      prompt: SAMPLE_PRESETS[1]?.starterPrompt ?? '',
      presetSlug: 'k8s-pod-telemetry',
      mode: 'fast',
    });

    // Switch to custom free-form mode, verify <4 char guard, then submit in llm mode.
    await user.click(selectTrigger);
    await waitFor(() => {
      expect(selectTrigger.getAttribute('aria-expanded')).toBe('true');
    });
    const customOption = await screen.findByRole('option', {
      name: /Custom Prompt \(Free-form\)/i,
    });
    await user.click(customOption);

    fireEvent.change(promptInput, { target: { value: '  ab ' } });
    const submitBtn = screen.getByTestId('cadence-run-submit') as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(true);

    fireEvent.change(promptInput, {
      target: { value: 'Custom 48-char latency diagnostic dashboard card' },
    });
    expect(submitBtn.disabled).toBe(false);

    await user.click(fastSwitch);
    expect(fastSwitch.getAttribute('aria-checked')).toBe('false');

    await user.click(submitBtn);
    expect(onRunBuild).toHaveBeenLastCalledWith({
      prompt: 'Custom 48-char latency diagnostic dashboard card',
      presetSlug: 'custom',
      mode: 'llm',
    });
  });

  it('renders progressive live CHORD phases, keeps starter preview during empty pending artifactHtml, and gates approval until ready', () => {
    const onRunBuild = vi.fn<NonNullable<PortalCadencePageProps['onRunBuild']>>();
    const onGateVerdict = vi.fn<NonNullable<PortalCadencePageProps['onGateVerdict']>>();

    const pendingInitRun: CadenceRunResult = {
      runId: '11111111-1111-4111-8111-111111111111',
      prompt: 'Build a Solar Forge card.',
      presetSlug: 'solar-forge-starter',
      runStatus: 'pending',
      mode: 'fast',
      gateVerdict: 'pending',
      turns: [
        {
          phase: 'triage',
          agentName: 'chord-triage',
          status: 'pending',
          summary: 'Queued',
          latencyMs: 0,
        },
        {
          phase: 'spec',
          agentName: 'chord-spec',
          status: 'pending',
          summary: 'Queued',
          latencyMs: 0,
        },
        {
          phase: 'build',
          agentName: 'chord-builder',
          status: 'pending',
          summary: 'Queued',
          latencyMs: 0,
        },
        {
          phase: 'gate',
          agentName: 'chord-gate',
          status: 'pending',
          summary: 'Queued',
          latencyMs: 0,
        },
      ],
      artifactHtml: '',
    };

    const { rerender } = render(
      <PortalCadencePage
        content={SAMPLE_CONTENT}
        presets={SAMPLE_PRESETS}
        actionResult={{ ok: true, intent: 'run-init', run: pendingInitRun }}
        isStreaming={true}
        onRunBuild={onRunBuild}
        onGateVerdict={onGateVerdict}
        onClose={vi.fn<() => void>()}
      />,
    );

    expect(screen.getByTestId('cadence-turn-triage').getAttribute('data-status')).toBe('pending');
    expect(screen.getByTestId('cadence-turn-spec').getAttribute('data-status')).toBe('pending');

    // Starter preview remains intact (non-empty) rather than flashing blank frame during streaming.
    const iframe = screen.getByTitle('CADENCE Artifact Preview') as HTMLIFrameElement;
    expect(iframe.getAttribute('sandbox')).toBe('allow-scripts');
    expect(iframe.getAttribute('srcdoc')).toContain('Starter Preset HTML');

    // Gate buttons remain disabled while runStatus !== 'ready'.
    const approveBtn = screen.getByTestId('cadence-gate-approve') as HTMLButtonElement;
    const rejectBtn = screen.getByTestId('cadence-gate-reject') as HTMLButtonElement;
    expect(approveBtn.disabled).toBe(true);
    expect(rejectBtn.disabled).toBe(true);

    // Mid-stream update: triage completed, spec running.
    rerender(
      <PortalCadencePage
        content={SAMPLE_CONTENT}
        presets={SAMPLE_PRESETS}
        isStreaming={true}
        actionResult={{
          ok: true,
          intent: 'run-init',
          run: {
            ...pendingInitRun,
            runStatus: 'running',
            turns: [
              {
                phase: 'triage',
                agentName: 'chord-triage',
                status: 'completed',
                summary: 'Triaged fast',
                latencyMs: 2,
              },
              {
                phase: 'spec',
                agentName: 'chord-spec',
                status: 'running',
                summary: 'Drafting spec...',
                latencyMs: 0,
              },
              ...(pendingInitRun.turns[2] ? [pendingInitRun.turns[2]] : []),
              ...(pendingInitRun.turns[3] ? [pendingInitRun.turns[3]] : []),
            ],
          },
        }}
        onRunBuild={onRunBuild}
        onGateVerdict={onGateVerdict}
        onClose={vi.fn<() => void>()}
      />,
    );
    expect(screen.getByTestId('cadence-turn-triage').getAttribute('data-status')).toBe('completed');
    expect(screen.getByTestId('cadence-turn-spec').getAttribute('data-status')).toBe('running');
    expect(approveBtn.disabled).toBe(true);

    // Completed run transitions runStatus -> 'ready', renders tailored HTML, and enables gate buttons.
    const completedRun: CadenceRunResult = {
      ...pendingInitRun,
      runStatus: 'ready',
      turns: pendingInitRun.turns.map(t => ({ ...t, status: 'completed', latencyMs: 4 })),
      artifactHtml: '<html><body>Built Tailored Artifact</body></html>',
      tokensIn: 120,
      tokensOut: 400,
    };

    rerender(
      <PortalCadencePage
        content={SAMPLE_CONTENT}
        presets={SAMPLE_PRESETS}
        isStreaming={false}
        actionResult={{ ok: true, intent: 'run', run: completedRun }}
        onRunBuild={onRunBuild}
        onGateVerdict={onGateVerdict}
        onClose={vi.fn<() => void>()}
      />,
    );

    expect(iframe.getAttribute('srcdoc')).toContain('Built Tailored Artifact');
    expect(approveBtn.disabled).toBe(false);
    fireEvent.click(approveBtn);
    expect(onGateVerdict).toHaveBeenCalledWith({
      runId: completedRun.runId,
      verdict: 'approved',
    });
  });

  it('renders optional code, action, and correlationId metadata inside the alert banner on failure', () => {
    render(
      <PortalCadencePage
        content={SAMPLE_CONTENT}
        presets={SAMPLE_PRESETS}
        actionResult={{
          ok: false,
          intent: 'run',
          error: 'Database temporarily unavailable.',
          code: 'ERR_DB_UNAVAILABLE',
          action: 'Retry shortly or share ID.',
          correlationId: 'corr-cadence-503',
        }}
        onClose={vi.fn<() => void>()}
      />,
    );

    const banner = screen.getByTestId('cadence-error-banner');
    expect(banner.getAttribute('role')).toBe('alert');
    expect(banner.textContent).toContain('Database temporarily unavailable.');
    expect(banner.textContent).toContain('ERR_DB_UNAVAILABLE');
    expect(banner.textContent).toContain('Retry shortly or share ID.');
    expect(banner.textContent).toContain('corr-cadence-503');
  });

  it('unblocks submit on interrupted stream error and retains latest quota across gate approval', () => {
    const runningRun: CadenceRunResult = {
      runId: '55555555-5555-4555-8555-555555555555',
      prompt: 'Recoverable stream run prompt.',
      presetSlug: 'solar-forge-starter',
      runStatus: 'running',
      mode: 'fast',
      gateVerdict: 'pending',
      turns: [],
      artifactHtml: '',
    };

    const { rerender } = render(
      <PortalCadencePage
        content={SAMPLE_CONTENT}
        presets={SAMPLE_PRESETS}
        quota={{ role: 'guest', turnsUsed: 0, maxTurns: 5, tokensUsed: 0, maxTokens: 20_000 }}
        actionResult={{
          ok: false,
          intent: 'run',
          error: 'Run stream interrupted. Reload or re-run to inspect progress.',
          run: runningRun,
        }}
        isStreaming={false}
        onRunBuild={vi.fn<NonNullable<PortalCadencePageProps['onRunBuild']>>()}
        onClose={vi.fn<() => void>()}
      />,
    );

    expect((screen.getByTestId('cadence-run-submit') as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByText(/CHORD stream interrupted/i)).toBeTruthy();

    rerender(
      <PortalCadencePage
        content={SAMPLE_CONTENT}
        presets={SAMPLE_PRESETS}
        quota={{ role: 'guest', turnsUsed: 0, maxTurns: 5, tokensUsed: 0, maxTokens: 20_000 }}
        actionResult={{
          ok: true,
          intent: 'run',
          run: {
            ...runningRun,
            runStatus: 'ready',
            artifactHtml: '<html><body>Ready</body></html>',
          },
          quota: { role: 'guest', turnsUsed: 1, maxTurns: 5, tokensUsed: 800, maxTokens: 20_000 },
        }}
        isStreaming={false}
        onRunBuild={vi.fn<NonNullable<PortalCadencePageProps['onRunBuild']>>()}
        onClose={vi.fn<() => void>()}
      />,
    );
    expect(screen.getByTestId('cadence-quota-meter').textContent).toContain('1/5 turns');

    rerender(
      <PortalCadencePage
        content={SAMPLE_CONTENT}
        presets={SAMPLE_PRESETS}
        quota={{ role: 'guest', turnsUsed: 0, maxTurns: 5, tokensUsed: 0, maxTokens: 20_000 }}
        actionResult={{
          ok: true,
          intent: 'gate',
          run: {
            ...runningRun,
            runStatus: 'ready',
            gateVerdict: 'approved',
            artifactHtml: '<html><body>Ready</body></html>',
          },
        }}
        isStreaming={false}
        onRunBuild={vi.fn<NonNullable<PortalCadencePageProps['onRunBuild']>>()}
        onClose={vi.fn<() => void>()}
      />,
    );
    expect(screen.getByTestId('cadence-quota-meter').textContent).toContain('1/5 turns');
  });
});
