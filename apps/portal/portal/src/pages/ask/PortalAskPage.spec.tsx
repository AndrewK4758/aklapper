import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ASK_TURN_STORAGE_KEY } from './askTurnRecovery';
import { PortalAskPage, type PortalAskPageProps } from './PortalAskPage';

const SAMPLE_CONTENT = {
  windowTitle: 'tui :: ask portfolio',
  statusBadge: {
    source: 'svc-ai-ask',
    state: 'idle' as const,
    label: '0/1 replicas',
  },
  description: 'Grounded Q&A and JD match.',
  starterQuestions: ['How does Cloud Run integrate with GKE?'],
  jdPlaceholder: 'Paste JD here...',
  abstentionNotice: 'Strict abstention active.',
};

const SAMPLE_QUOTA = {
  role: 'guest' as const,
  turnsUsed: 0,
  maxTurns: 5,
  tokensUsed: 0,
  maxTokens: 20_000,
};

describe('PortalAskPage', () => {
  afterEach(() => {
    window.sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('fills starter questions, submits Q&A with attemptId, and renders telemetry on both Q&A and JD Match cards', () => {
    const onSubmitAsk = vi.fn<PortalAskPageProps['onSubmitAsk']>();
    const { rerender } = render(
      <PortalAskPage
        content={SAMPLE_CONTENT}
        quota={SAMPLE_QUOTA}
        askStatus={{ status: 'ready', provider: 'ai-ask', pointsCount: 14 }}
        isSubmitting={false}
        onSubmitAsk={onSubmitAsk}
        onClose={vi.fn<() => void>()}
      />,
    );

    expect(screen.getByText(/ready · 14 pts/)).toBeTruthy();

    fireEvent.click(screen.getByTestId('ask-starter-0'));
    fireEvent.click(screen.getByTestId('ask-qa-submit'));
    expect(onSubmitAsk).toHaveBeenCalledWith({
      mode: 'qa',
      text: 'How does Cloud Run integrate with GKE?',
      attemptId: expect.any(String),
    });

    const qaAttemptId = onSubmitAsk.mock.calls[0]?.[0]?.attemptId;
    rerender(
      <PortalAskPage
        content={SAMPLE_CONTENT}
        quota={SAMPLE_QUOTA}
        actionResult={{
          ok: true,
          mode: 'qa',
          submittedText: 'How does Cloud Run integrate with GKE?',
          attemptId: qaAttemptId,
          response: {
            attemptId: qaAttemptId,
            grounded: true,
            abstained: false,
            mode: 'qa',
            answer: 'Cloud Run serves SSR and proxies live workloads to GKE Autopilot.',
            sources: [
              {
                id: 'doc-1',
                title: 'Portfolio Architecture',
                snippet: 'Cloud Run + GKE Autopilot.',
                score: 0.91,
                category: 'architecture',
              },
            ],
            provider: 'local-llama-swap',
            model: 'gemma-4',
            tokensUsed: 412,
            latencyMs: 320,
            quota: { ...SAMPLE_QUOTA, turnsUsed: 1, tokensUsed: 412 },
          },
        }}
        isSubmitting={false}
        onSubmitAsk={onSubmitAsk}
        onClose={vi.fn<() => void>()}
      />,
    );

    expect(screen.getByTestId('ask-qa-transcript')).toBeTruthy();
    expect(screen.getByText(/Cloud Run serves SSR/)).toBeTruthy();
    expect(screen.getByText('Portfolio Architecture')).toBeTruthy();
    const qaTelemetry = screen.getByTestId('ask-telemetry-line');
    expect(qaTelemetry.textContent).toContain('local-llama-swap');
    expect(qaTelemetry.textContent).toContain('gemma-4');
    expect(qaTelemetry.textContent).toContain('412');

    // Switch to JD Match tab, enforce 8000-char limit, and verify JD telemetry strip
    fireEvent.click(screen.getByTestId('ask-tab-jd'));
    const jdInput = screen.getByTestId('ask-jd-textarea');
    expect(jdInput.getAttribute('maxLength')).toBe('8000');

    const jdPayload = 'A'.repeat(7500);
    fireEvent.change(jdInput, { target: { value: jdPayload } });
    fireEvent.click(screen.getByTestId('ask-jd-submit'));
    expect(onSubmitAsk).toHaveBeenLastCalledWith({
      mode: 'jd_match',
      text: jdPayload,
      attemptId: expect.any(String),
    });

    const jdAttemptId = onSubmitAsk.mock.calls[1]?.[0]?.attemptId;
    rerender(
      <PortalAskPage
        content={SAMPLE_CONTENT}
        quota={SAMPLE_QUOTA}
        actionResult={{
          ok: true,
          mode: 'jd_match',
          submittedText: jdPayload,
          attemptId: jdAttemptId,
          response: {
            attemptId: jdAttemptId,
            grounded: true,
            abstained: false,
            mode: 'jd_match',
            answer: 'Strong fit across Go microservices and streaming React Router SSR.',
            matchScore: 88,
            strengths: ['Go microservices on GKE Autopilot'],
            gaps: ['No Terraform HCL evidence'],
            sources: [
              {
                id: 'doc-2',
                title: 'Go Services',
                snippet: 'GKE Autopilot Go services.',
                score: 0.87,
                category: 'backend',
              },
            ],
            provider: 'vertex-ai-gemini',
            model: 'gemini-2.5-flash',
            tokensUsed: 940,
            quota: { ...SAMPLE_QUOTA, turnsUsed: 2, tokensUsed: 1352 },
          },
        }}
        isSubmitting={false}
        onSubmitAsk={onSubmitAsk}
        onClose={vi.fn<() => void>()}
      />,
    );

    const jdCard = screen.getByTestId('ask-jd-result');
    expect(jdCard.textContent).toContain('88%');
    expect(jdCard.textContent).toContain('vertex-ai-gemini');
    expect(jdCard.textContent).toContain('gemini-2.5-flash');
    expect(jdCard.textContent).toContain('940');
  });

  it('recovers active pending turn from sessionStorage on mount without re-submitting POST /ask', async () => {
    const attemptId = '55555555-5555-4555-8555-555555555555';
    window.sessionStorage.setItem(
      ASK_TURN_STORAGE_KEY,
      JSON.stringify({
        attemptId,
        mode: 'qa',
        question: 'How are database migrations deployed cleanly?',
      }),
    );

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      Response.json({
        attemptId,
        status: 'completed',
        mode: 'qa',
        correlationId: 'corr-recover-1',
        leaseExpiresAt: '2026-11-24T22:01:00Z',
        expiresAt: '2026-11-24T22:15:00Z',
        response: {
          attemptId,
          grounded: true,
          abstained: false,
          mode: 'qa',
          answer: 'Migrations use additive expand/contract DDL via Drizzle.',
          sources: [
            {
              id: 'doc-mig',
              title: 'Drizzle Migrations',
              snippet: 'Expand/contract migrations in PG19.',
              score: 0.92,
              category: 'database',
            },
          ],
          provider: 'local-llama-swap',
          model: 'gemma-4',
          tokensUsed: 305,
          quota: { ...SAMPLE_QUOTA, turnsUsed: 1, tokensUsed: 305 },
        },
      }),
    );

    const onSubmitAsk = vi.fn<PortalAskPageProps['onSubmitAsk']>();
    render(
      <PortalAskPage
        content={SAMPLE_CONTENT}
        quota={SAMPLE_QUOTA}
        isSubmitting={false}
        onSubmitAsk={onSubmitAsk}
        onClose={vi.fn<() => void>()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId('ask-qa-transcript')).toBeTruthy();
    });

    expect(onSubmitAsk).not.toHaveBeenCalled();
    expect(fetchSpy).toHaveBeenCalledWith(
      `/api/ask/turns/${attemptId}`,
      expect.objectContaining({ method: 'GET' }),
    );
    expect(
      screen.getByText('Migrations use additive expand/contract DDL via Drizzle.'),
    ).toBeTruthy();
    expect(screen.getByText('1/5 turns')).toBeTruthy();
    expect(window.sessionStorage.getItem(ASK_TURN_STORAGE_KEY)).toBeNull();
  });

  it('transitions a 202 pending response through /api/ask/turns polling to completion', async () => {
    const attemptId = '66666666-6666-4666-8666-666666666666';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      Response.json({
        attemptId,
        status: 'completed',
        mode: 'qa',
        correlationId: 'corr-pending-done',
        leaseExpiresAt: '2026-11-24T22:01:00Z',
        expiresAt: '2026-11-24T22:15:00Z',
        response: {
          attemptId,
          grounded: true,
          abstained: false,
          mode: 'qa',
          answer: 'Detached Go worker completed synthesis cleanly.',
          sources: [],
          provider: 'local-llama-swap',
          model: 'gemma-4',
          tokensUsed: 250,
          quota: { ...SAMPLE_QUOTA, turnsUsed: 1, tokensUsed: 250 },
        },
      }),
    );

    render(
      <PortalAskPage
        content={SAMPLE_CONTENT}
        quota={SAMPLE_QUOTA}
        actionResult={{
          ok: true,
          pending: true,
          mode: 'qa',
          submittedText: 'Describe cold-start recovery.',
          attemptId,
          turnState: {
            attemptId,
            status: 'running',
            mode: 'qa',
            correlationId: 'corr-pending-start',
            leaseExpiresAt: '2026-11-24T22:01:00Z',
            expiresAt: '2026-11-24T22:15:00Z',
          },
        }}
        isSubmitting={false}
        onSubmitAsk={vi.fn<PortalAskPageProps['onSubmitAsk']>()}
        onClose={vi.fn<() => void>()}
      />,
    );

    expect(screen.getByTestId('ask-turn-pending')).toBeTruthy();
    await waitFor(
      () => {
        expect(screen.getByText('Detached Go worker completed synthesis cleanly.')).toBeTruthy();
      },
      { timeout: 2_500 },
    );
    expect(fetchSpy).toHaveBeenCalledWith(
      `/api/ask/turns/${attemptId}`,
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('renders optional code, action, and correlationId metadata inside the alert banner on failure', () => {
    render(
      <PortalAskPage
        content={SAMPLE_CONTENT}
        quota={SAMPLE_QUOTA}
        actionResult={{
          ok: false,
          mode: 'qa',
          error: 'Database temporarily unavailable.',
          code: 'ERR_DB_UNAVAILABLE',
          action: 'Retry shortly or share ID.',
          correlationId: 'corr-ask-503',
        }}
        isSubmitting={false}
        onSubmitAsk={vi.fn<PortalAskPageProps['onSubmitAsk']>()}
        onClose={vi.fn<() => void>()}
      />,
    );

    const banner = screen.getByTestId('ask-error-banner');
    expect(banner.getAttribute('role')).toBe('alert');
    expect(banner.textContent).toContain('Database temporarily unavailable.');
    expect(banner.textContent).toContain('ERR_DB_UNAVAILABLE');
    expect(banner.textContent).toContain('Retry shortly or share ID.');
    expect(banner.textContent).toContain('corr-ask-503');
  });
});
