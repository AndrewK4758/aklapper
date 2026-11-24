import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

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
  maxTokens: 100_000,
};

describe('PortalAskPage', () => {
  it('fills starter questions, submits Q&A, and renders grounded transcript and JD match results', () => {
    const onSubmitAsk = vi.fn<PortalAskPageProps['onSubmitAsk']>();
    const { rerender } = render(
      <PortalAskPage
        content={SAMPLE_CONTENT}
        quota={SAMPLE_QUOTA}
        isSubmitting={false}
        onSubmitAsk={onSubmitAsk}
        onClose={vi.fn<() => void>()}
      />,
    );

    fireEvent.click(screen.getByTestId('ask-starter-0'));
    fireEvent.click(screen.getByTestId('ask-qa-submit'));
    expect(onSubmitAsk).toHaveBeenCalledWith({
      mode: 'qa',
      text: 'How does Cloud Run integrate with GKE?',
    });

    rerender(
      <PortalAskPage
        content={SAMPLE_CONTENT}
        quota={SAMPLE_QUOTA}
        actionResult={{
          ok: true,
          mode: 'qa',
          submittedText: 'How does Cloud Run integrate with GKE?',
          response: {
            grounded: true,
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
            provider: 'pg19-local-corpus',
            tokensUsed: 0,
            quota: { ...SAMPLE_QUOTA, turnsUsed: 1 },
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
  });
});
