import {
  type CadencePreset,
  type CadenceRunResult,
  PortalCadenceContentSchema,
} from '@aklapper/core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PortalCadencePage, type PortalCadencePageProps } from './PortalCadencePage';

const SAMPLE_CONTENT = PortalCadenceContentSchema.parse({
  windowTitle: 'CADENCE Builder // portfolio-public',
  statusBadge: {
    source: 'svc-cadence-demo',
    state: 'idle' as const,
    label: '0/1 replicas',
  },
  description: 'Quota-gated prompt builder.',
  iframeTitle: 'CADENCE Artifact Preview',
});

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

    // Fast mode Switch defaults to unchecked ('llm') so Live LLM generation runs by default.
    const fastSwitch = screen.getByTestId('cadence-fast-mode-switch');
    expect(fastSwitch.getAttribute('aria-checked')).toBe('false');

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
      mode: 'llm',
    });

    // Switch to custom free-form mode, verify <4 char guard, then toggle Fast Mode on and submit.
    await user.click(selectTrigger);
    await waitFor(() => {
      expect(selectTrigger.getAttribute('aria-expanded')).toBe('true');
    });
    const customOption = await screen.findByRole('option', {
      name: /Custom Prompt/i,
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
    expect(fastSwitch.getAttribute('aria-checked')).toBe('true');

    await user.click(submitBtn);
    expect(onRunBuild).toHaveBeenLastCalledWith({
      prompt: 'Custom 48-char latency diagnostic dashboard card',
      presetSlug: 'custom',
      mode: 'fast',
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

    // Do NOT show pre-baked starter HTML before Build completes, and auto-select the Pipeline Stream Output tab.
    expect(screen.queryByTitle('CADENCE Artifact Preview')).toBeNull();
    expect(screen.getByTestId('cadence-view-stream').getAttribute('aria-selected')).toBe('true');
    expect(screen.getByTestId('cadence-stream-panel')).toBeTruthy();

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

    expect(screen.getByTestId('cadence-view-preview').getAttribute('aria-selected')).toBe('true');
    const iframe = screen.getByTitle('CADENCE Artifact Preview') as HTMLIFrameElement;
    expect(iframe.getAttribute('sandbox')).toBe('allow-scripts');
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

  it('toggles preview/source HTML, renders inspectable CHORD phase payloads, unlocks export on approval, and supports revision re-run on rejection', async () => {
    const user = userEvent.setup();
    const onRunBuild = vi.fn<NonNullable<PortalCadencePageProps['onRunBuild']>>();
    const readyRun: CadenceRunResult = {
      runId: '44444444-4444-4444-8444-444444444444',
      prompt: 'Build an interactive pod monitor',
      presetSlug: 'k8s-pod-telemetry',
      runStatus: 'ready',
      mode: 'fast',
      gateVerdict: 'approved',
      turns: [
        {
          phase: 'triage',
          agentName: 'chord-triage',
          status: 'completed',
          summary: 'Classified prompt',
          latencyMs: 2,
          payload: {
            detectedKeywords: ['pod', 'monitor'],
            isolationPolicy: 'sandbox=allow-scripts',
          },
        },
        {
          phase: 'build',
          agentName: 'chord-builder',
          status: 'completed',
          summary: 'Built artifact',
          latencyMs: 12,
          payload: {
            provider: 'deterministic-fast',
            artifactBytes: 2048,
          },
        },
        {
          phase: 'gate',
          agentName: 'chord-gate',
          status: 'completed',
          summary: 'Sanitizer passed',
          latencyMs: 3,
          payload: {
            checks: ['Strict CSP meta injected', 'Payload size verified'],
          },
        },
      ],
      artifactHtml: '<!doctype html><html><body><h1>Pod Telemetry</h1></body></html>',
    };

    const { rerender } = render(
      <PortalCadencePage
        content={SAMPLE_CONTENT}
        presets={SAMPLE_PRESETS}
        recentRuns={[readyRun]}
        onRunBuild={onRunBuild}
        onGateVerdict={vi.fn<NonNullable<PortalCadencePageProps['onGateVerdict']>>()}
        onClose={vi.fn<() => void>()}
      />,
    );

    // Phase payload inspector details are rendered.
    expect(screen.getByTestId('cadence-turn-details-triage').textContent).toContain('pod');
    expect(screen.getByTestId('cadence-turn-details-build').textContent).toContain(
      'deterministic-fast',
    );
    expect(screen.getByTestId('cadence-turn-details-gate').textContent).toContain(
      'Strict CSP meta injected',
    );

    // Toggle to Source Code tab, inspect code & download button, and return to Preview.
    await user.click(screen.getByTestId('cadence-view-source'));
    expect(screen.getByTestId('cadence-source-code').textContent).toContain('Pod Telemetry');
    expect(screen.getByTestId('cadence-download-html')).toBeTruthy();
    await user.click(screen.getByTestId('cadence-view-preview'));
    expect(screen.getByTitle('CADENCE Artifact Preview')).toBeTruthy();

    // Rejected gate shows revision form and submits appended revision prompt.
    rerender(
      <PortalCadencePage
        content={SAMPLE_CONTENT}
        presets={SAMPLE_PRESETS}
        actionResult={{
          ok: true,
          intent: 'gate',
          run: { ...readyRun, gateVerdict: 'rejected' },
        }}
        onRunBuild={onRunBuild}
        onGateVerdict={vi.fn<NonNullable<PortalCadencePageProps['onGateVerdict']>>()}
        onClose={vi.fn<() => void>()}
      />,
    );

    expect(screen.getByTestId('cadence-revision-form')).toBeTruthy();
    await user.type(screen.getByTestId('cadence-revision-input'), 'Add p99 latency bars');
    await user.click(screen.getByTestId('cadence-revision-submit'));
    expect(onRunBuild).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining('Revision: Add p99 latency bars'),
      }),
    );
  });

  it('auto-loads the first Golden Showcase at $0 cost and hides gate override buttons on read-only Golden runs', async () => {
    const user = userEvent.setup();
    const goldenRun: CadenceRunResult = {
      runId: '00000000-0000-4000-8000-000000000101',
      prompt: 'Demonstrate CHORD decomposition.',
      presetSlug: 'solar-forge-starter',
      runStatus: 'ready',
      mode: 'llm',
      executionMode: 'golden',
      isGolden: true,
      gateVerdict: 'approved',
      turns: [],
      artifactHtml: '<!doctype html><html><body>Golden Methodology Workbench</body></html>',
      spec: {
        title: 'CHORD Behavioral Decomposition Workbench',
        summary: 'Zero-cost verified methodology showcase.',
        conditions: ['First paint on /cadence'],
        handling: ['Auto-select goldenRuns[0]'],
        outcomes: ['Zero LLM calls'],
        rules: ['Read-only Golden showcase'],
        deltas: ['No DB writes'],
      },
      gateAudit: {
        summary: 'Verified Golden SHA-256 CSP.',
        sanitized: false,
        artifactBytes: 68,
        checks: [
          { id: 'csp', label: 'Strict CSP', status: 'pass', detail: 'No unsafe-inline scripts.' },
        ],
      },
    };

    render(
      <PortalCadencePage
        content={SAMPLE_CONTENT}
        presets={SAMPLE_PRESETS}
        goldenRuns={[goldenRun]}
        recentRuns={[]}
        onGateVerdict={vi.fn<NonNullable<PortalCadencePageProps['onGateVerdict']>>()}
        onClose={vi.fn<() => void>()}
      />,
    );

    expect(screen.getByTestId('cadence-golden-strip')).toBeTruthy();
    const liveSpecView = screen.getByTestId('cadence-live-spec-view');
    expect(liveSpecView.textContent).toContain('CHORD Behavioral Decomposition Workbench');
    expect(liveSpecView.textContent).toContain('First paint on /cadence');
    expect(screen.getByTestId('cadence-view-preview').getAttribute('aria-selected')).toBe('true');
    const iframe = screen.getByTitle('CADENCE Artifact Preview') as HTMLIFrameElement;
    expect(iframe.getAttribute('srcdoc')).toContain('Golden Methodology Workbench');
    expect(screen.getByTestId('cadence-execution-mode-badge').textContent).toContain(
      'Golden Showcase',
    );
    expect(screen.getByTestId('cadence-golden-readonly-pill')).toBeTruthy();
    expect(screen.queryByTestId('cadence-gate-approve')).toBeNull();
    expect(screen.queryByTestId('cadence-gate-reject')).toBeNull();

    await user.click(screen.getByTestId('cadence-view-gate'));
    expect(screen.getByTestId('gate-audit-readonly-notice')).toBeTruthy();
    expect(screen.queryByTestId('gate-audit-approve')).toBeNull();
  });

  it('pauses at the Human Spec Gate (awaiting_approval), locks Build preview, and dispatches approve or spec revision', async () => {
    const user = userEvent.setup();
    const onApproveSpec = vi.fn<(runId: string) => void>();
    const onRunBuild = vi.fn<NonNullable<PortalCadencePageProps['onRunBuild']>>();

    const pausedRun: CadenceRunResult = {
      runId: '77777777-7777-4777-8777-777777777777',
      prompt: 'Build a zero-trust deployment checklist',
      presetSlug: 'custom',
      runStatus: 'awaiting_approval',
      mode: 'llm',
      executionMode: 'live',
      gateVerdict: 'pending',
      turns: [
        {
          phase: 'triage',
          agentName: 'chord-triage',
          status: 'completed',
          summary: 'Classified prompt',
          latencyMs: 3,
        },
        {
          phase: 'spec',
          agentName: 'chord-spec',
          status: 'completed',
          summary: 'Authored live CHORD spec',
          latencyMs: 1200,
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
      spec: {
        title: 'Zero-Trust Deployment Checklist',
        summary: 'Interactive pre-deploy verification workbench.',
        conditions: ['Operator supplies target namespace'],
        handling: ['Render pure-CSS checkbox verification matrix'],
        outcomes: ['Visual pass/fail readiness scorecard'],
        rules: ['No inline scripts or external network calls'],
        deltas: ['Persists approved CHORD spec before build'],
      },
    };

    render(
      <PortalCadencePage
        content={SAMPLE_CONTENT}
        presets={SAMPLE_PRESETS}
        recentRuns={[pausedRun]}
        onRunBuild={onRunBuild}
        onApproveSpec={onApproveSpec}
        onClose={vi.fn<() => void>()}
      />,
    );

    expect(screen.getByTestId('cadence-pipeline-rail')).toBeTruthy();
    expect(screen.getByTestId('cadence-rail-human-gate').getAttribute('data-status')).toBe('gate');
    expect(screen.getByTestId('cadence-human-spec-gate')).toBeTruthy();
    expect(screen.getByTestId('cadence-live-spec-view').textContent).toContain(
      'Zero-Trust Deployment Checklist',
    );
    expect(screen.getByTestId('cadence-build-locked-panel')).toBeTruthy();

    await user.click(screen.getByTestId('cadence-view-source'));
    expect(screen.getByTestId('cadence-source-empty')).toBeTruthy();
    await user.click(screen.getByTestId('cadence-view-preview'));

    await user.click(screen.getByTestId('cadence-spec-approve'));
    expect(onApproveSpec).toHaveBeenCalledWith(pausedRun.runId);

    await user.type(screen.getByTestId('cadence-spec-revise-input'), 'Add rollback triggers');
    await user.click(screen.getByTestId('cadence-spec-revise-submit'));
    expect(onRunBuild).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining('Spec Revision: Add rollback triggers'),
      }),
    );
  });

  it('resets timeline, pipeline steps, spec, preview, source code, gate audit, and prompt to a completely blank state', async () => {
    const user = userEvent.setup();
    const onReset = vi.fn<() => void>();
    const runningRun: CadenceRunResult = {
      runId: 'run-mid-stream-1',
      prompt: 'Custom mid-flight prompt',
      presetSlug: 'custom',
      runStatus: 'running',
      mode: 'llm',
      executionMode: 'live',
      gateVerdict: 'pending',
      turns: [
        {
          phase: 'triage',
          agentName: 'chord-triage',
          status: 'completed',
          summary: 'Classified prompt',
          latencyMs: 5,
        },
        {
          phase: 'spec',
          agentName: 'chord-spec',
          status: 'running',
          summary: 'Authoring spec...',
          latencyMs: 0,
        },
      ],
      artifactHtml: '',
    };

    const goldenRun: CadenceRunResult = {
      runId: 'golden-run-1',
      prompt: 'Golden showcase prompt',
      presetSlug: 'solar-forge-starter',
      runStatus: 'ready',
      mode: 'fast',
      executionMode: 'golden',
      isGolden: true,
      gateVerdict: 'approved',
      turns: [
        {
          phase: 'triage',
          agentName: 'chord-triage',
          status: 'completed',
          summary: 'Golden triage',
          latencyMs: 2,
        },
      ],
      artifactHtml: '<html><body>Golden HTML</body></html>',
      spec: {
        title: 'Golden Spec',
        summary: 'Golden summary',
        conditions: ['Condition A'],
        handling: ['Handling A'],
        outcomes: ['Outcome A'],
        rules: ['Rule A'],
        deltas: ['Delta A'],
      },
      gateAudit: {
        summary: 'Passed',
        sanitized: true,
        artifactBytes: 38,
        checks: [{ id: 'csp', label: 'CSP', status: 'pass', detail: 'ok' }],
      },
    };

    const { rerender } = render(
      <PortalCadencePage
        content={SAMPLE_CONTENT}
        presets={SAMPLE_PRESETS}
        goldenRuns={[goldenRun]}
        recentRuns={[runningRun]}
        isStreaming={true}
        onRunBuild={vi.fn<() => void>()}
        onReset={() => {
          onReset();
          rerender(
            <PortalCadencePage
              content={SAMPLE_CONTENT}
              presets={SAMPLE_PRESETS}
              goldenRuns={[goldenRun]}
              recentRuns={[]}
              isStreaming={false}
              onRunBuild={vi.fn<() => void>()}
              onReset={onReset}
              onClose={vi.fn<() => void>()}
            />,
          );
        }}
        onClose={vi.fn<() => void>()}
      />,
    );

    const resetButton = screen.getByTestId('cadence-reset-button') as HTMLButtonElement;
    expect(resetButton.disabled).toBe(false);
    expect(screen.getByTestId('cadence-run-history')).toBeTruthy();

    await user.click(resetButton);

    expect(onReset).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('cadence-run-history')).toBeNull();
    expect(screen.queryByTestId('cadence-active-run')).toBeNull();
    expect(screen.getByTestId('cadence-spec-status-pill').textContent).toBe('Ready');
    for (const step of ['triage', 'spec', 'human-gate', 'build', 'gate']) {
      expect(screen.getByTestId(`cadence-rail-${step}`).getAttribute('data-status')).toBe(
        'pending',
      );
    }
    expect((screen.getByTestId('cadence-prompt-input') as HTMLTextAreaElement).value).toBe('');
    await user.click(screen.getByTestId('cadence-view-source'));
    expect(screen.getByTestId('cadence-source-empty')).toBeTruthy();
  });
});
