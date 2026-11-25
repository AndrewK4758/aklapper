import type { CadenceGateAudit, CadenceSpecArtifact } from '@aklapper/core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ArtifactInspector, CodeArtifactViewer, GateAuditChecklist } from '../src/index';

const SAMPLE_SPEC: CadenceSpecArtifact = {
  title: 'CHORD Behavioral Decomposition Workbench',
  summary: 'Interactive five-axis specification workbench.',
  conditions: ['Visitor opens /cadence with zero prior runs.'],
  handling: ['Auto-load verified Golden Showcase artifact at $0 cost.'],
  outcomes: ['All four inspector tabs render cleanly.'],
  rules: ['Never expose allow-same-origin on sandboxed frames.'],
  deltas: ['Zero database writes on read-only inspection.'],
  recalledPatterns: ['chord-decomposition', 'strict-csp'],
};

const SAMPLE_GATE_AUDIT: CadenceGateAudit = {
  summary: 'Artifact passed strict SHA-256 CSP and sandbox isolation checks.',
  sanitized: false,
  artifactBytes: 1240,
  checks: [
    {
      id: 'csp',
      label: 'Strict SHA-256 CSP',
      status: 'pass',
      detail: 'Zero unsafe-inline scripts.',
    },
    {
      id: 'size',
      label: 'Artifact Size Budget',
      status: 'warn',
      detail: 'Within 48 KiB ceiling.',
    },
  ],
};

const SAMPLE_HTML =
  '<!doctype html>\n<html lang="en">\n  <!-- sample -->\n  <body><h1>Solar Forge</h1></body>\n</html>';

describe('CodeArtifactViewer, GateAuditChecklist, and ArtifactInspector', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders syntax-highlighted spans, byte count, copy feedback, clipboard error fallback, and Blob download', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValueOnce(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    const createObjectURL = vi.fn<(obj: Blob | MediaSource) => string>(() => 'blob:cadence-test');
    const revokeObjectURL = vi.fn<(url: string) => void>();
    vi.spyOn(URL, 'createObjectURL').mockImplementation(createObjectURL);
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(revokeObjectURL);
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    const { rerender } = render(
      <CodeArtifactViewer
        code={SAMPLE_HTML}
        fileName='showcase.html'
        copyLabel='Copy HTML'
        copiedLabel='Copied!'
        downloadLabel='Download HTML'
      />,
    );

    const codeEl = screen.getByTestId('cadence-source-code');
    expect(codeEl.textContent).toContain('Solar Forge');
    expect(codeEl.querySelectorAll('span').length).toBeGreaterThan(5);
    expect(screen.getByTestId('code-artifact-bytes').textContent).toContain('bytes');

    await user.click(screen.getByTestId('cadence-copy-html'));
    expect(writeText).toHaveBeenCalledWith(SAMPLE_HTML);
    expect(await screen.findByText('Copied!')).toBeTruthy();

    await user.click(screen.getByTestId('cadence-download-html'));
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:cadence-test');

    // Clipboard rejection degrades gracefully with an inline alert instead of throwing.
    writeText.mockRejectedValueOnce(new Error('Clipboard denied'));
    rerender(<CodeArtifactViewer code={SAMPLE_HTML} copyLabel='Copy HTML' />);
    await user.click(screen.getByTestId('cadence-copy-html'));
    const alert = await screen.findByTestId('code-artifact-copy-error');
    expect(alert.getAttribute('role')).toBe('alert');
  });

  it('renders GateAuditChecklist checks, hides gate buttons on Golden runs, and invokes callbacks on visitor runs', () => {
    const onGateVerdict = vi.fn<(verdict: 'approved' | 'rejected') => void>();

    const { rerender } = render(
      <GateAuditChecklist
        gateAudit={SAMPLE_GATE_AUDIT}
        gateVerdict='approved'
        isGolden={true}
        goldenVerifiedLabel='Verified Golden'
        goldenReadOnlyNotice='Read-only Golden artifact.'
        onGateVerdict={onGateVerdict}
      />,
    );

    expect(screen.getByTestId('gate-audit-golden-badge').textContent).toContain('Verified Golden');
    expect(screen.getByTestId('gate-audit-readonly-notice').textContent).toContain(
      'Read-only Golden artifact.',
    );
    expect(screen.queryByTestId('gate-audit-approve')).toBeNull();
    expect(screen.queryByTestId('gate-audit-reject')).toBeNull();
    expect(screen.getByText('Strict SHA-256 CSP')).toBeTruthy();

    rerender(
      <GateAuditChecklist
        gateAudit={SAMPLE_GATE_AUDIT}
        gateVerdict='pending'
        isGolden={false}
        isRunReady={true}
        onGateVerdict={onGateVerdict}
      />,
    );

    fireEvent.click(screen.getByTestId('gate-audit-approve'));
    expect(onGateVerdict).toHaveBeenCalledWith('approved');
    fireEvent.click(screen.getByTestId('gate-audit-reject'));
    expect(onGateVerdict).toHaveBeenCalledWith('rejected');
  });

  it('switches across Preview, Spec, Source Code, Gate Audit, and Live Stream tabs and opens fullscreen dialog', async () => {
    const user = userEvent.setup();

    render(
      <ArtifactInspector
        artifactHtml={SAMPLE_HTML}
        executionMode='golden'
        isGolden={true}
        spec={SAMPLE_SPEC}
        gateAudit={SAMPLE_GATE_AUDIT}
        gateVerdict='approved'
        isStreaming={false}
        streamLogs={['[triage] classified prompt', '[gate] strict csp verified']}
        labels={{
          iframeTitle: 'CADENCE Preview Frame',
          tabPreviewLabel: 'Preview',
          tabSpecLabel: 'Spec',
          tabSourceLabel: 'Source Code',
          tabGateAuditLabel: 'Gate Audit',
          streamLogHeading: 'Live Stream',
          fullscreenLabel: 'Fullscreen',
          exitFullscreenLabel: 'Exit Fullscreen',
          modeBadgeGoldenLabel: 'Golden Showcase',
        }}
      />,
    );

    const iframe = screen.getByTitle('CADENCE Preview Frame');
    expect(iframe.getAttribute('sandbox')).toBe('allow-scripts');
    expect(iframe.getAttribute('sandbox')).not.toContain('allow-same-origin');
    expect(iframe.getAttribute('referrerpolicy')).toBe('no-referrer');
    expect(screen.getByTestId('cadence-execution-mode-badge').textContent).toContain(
      'Golden Showcase',
    );

    await user.click(screen.getByTestId('cadence-view-spec'));
    expect(await screen.findByText('CHORD Behavioral Decomposition Workbench')).toBeTruthy();
    expect(screen.getByText('chord-decomposition')).toBeTruthy();

    await user.click(screen.getByTestId('cadence-view-source'));
    expect((await screen.findByTestId('cadence-source-code')).textContent).toContain('Solar Forge');

    await user.click(screen.getByTestId('cadence-view-gate'));
    expect(await screen.findByTestId('gate-audit-checklist')).toBeTruthy();

    await user.click(screen.getByTestId('cadence-view-stream'));
    expect((await screen.findByTestId('cadence-stream-panel')).textContent).toContain(
      '[triage] classified prompt',
    );

    await user.click(screen.getByTestId('cadence-fullscreen-toggle'));
    const dialog = await screen.findByTestId('cadence-fullscreen-dialog');
    expect(dialog.getAttribute('role')).toBe('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('data-fullscreen')).toBe('true');

    await user.click(screen.getByRole('button', { name: 'Exit Fullscreen' }));
    await waitFor(() => {
      expect(screen.queryByTestId('cadence-fullscreen-dialog')).toBeNull();
    });
  });

  it('degrades gracefully when spec and gateAudit are omitted on legacy runs', async () => {
    const user = userEvent.setup();
    render(
      <ArtifactInspector
        artifactHtml={SAMPLE_HTML}
        labels={{
          iframeTitle: 'Legacy Frame',
          emptySpecNotice: 'Legacy metadata unavailable.',
        }}
      />,
    );

    await user.click(screen.getByTestId('cadence-view-spec'));
    expect(await screen.findByText('Legacy metadata unavailable.')).toBeTruthy();

    await user.click(screen.getByTestId('cadence-view-gate'));
    expect(await screen.findByText('Legacy metadata unavailable.')).toBeTruthy();
  });
});
