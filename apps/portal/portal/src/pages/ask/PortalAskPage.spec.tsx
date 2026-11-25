import { PortalAskContentSchema } from '@aklapper/core';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { streamAskQuestion } from './askStreamClient';
import {
  ASK_TURN_STORAGE_KEY,
  clearPersistedAskTurn,
  readPersistedAskTurn,
  resolveAskTurnStorageKey,
  writePersistedAskTurn,
} from './askTurnRecovery';
import { PortalAskPage, type PortalAskPageProps } from './PortalAskPage';

const SAMPLE_CONTENT = PortalAskContentSchema.parse({
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
});

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

  it('recovers active pending turn from sessionStorage on mount without re-submitting POST /chat', async () => {
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

    const onSubmitAsk = vi.fn<PortalAskPageProps['onSubmitAsk']>();
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
        onSubmitAsk={onSubmitAsk}
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
    expect(screen.queryByTestId('ask-turn-pending')).toBeNull();

    // Verify tabs and subsequent submissions unlock even while fetcher.data stays 202 pending
    fireEvent.click(screen.getByTestId('ask-tab-jd'));
    expect((screen.getByTestId('ask-jd-textarea') as HTMLTextAreaElement).disabled).toBe(false);
    fireEvent.click(screen.getByTestId('ask-tab-qa'));
    fireEvent.click(screen.getByTestId('ask-starter-0'));
    const qaSubmit = screen.getByTestId('ask-qa-submit') as HTMLButtonElement;
    expect(qaSubmit.disabled).toBe(false);
    fireEvent.click(qaSubmit);
    expect(onSubmitAsk).toHaveBeenCalledWith({
      mode: 'qa',
      text: 'How does Cloud Run integrate with GKE?',
      attemptId: expect.any(String),
    });
  });

  it('unblocks UI and refreshes quota when a 202 pending turn fails during /api/ask/turns polling', async () => {
    const attemptId = '77777777-7777-4777-8777-777777777777';
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      Response.json({
        attemptId,
        status: 'failed',
        mode: 'qa',
        correlationId: 'corr-pending-fail',
        leaseExpiresAt: '2026-11-24T22:01:00Z',
        expiresAt: '2026-11-24T22:15:00Z',
        quota: { ...SAMPLE_QUOTA, turnsUsed: 0, tokensUsed: 0 },
        error: {
          code: 'ERR_UPSTREAM_UNAVAILABLE',
          status: 503,
          message: 'Upstream inference failed cleanly.',
          action: 'Retry your question.',
          correlationId: 'corr-pending-fail',
        },
      }),
    );

    const onSubmitAsk = vi.fn<PortalAskPageProps['onSubmitAsk']>();
    render(
      <PortalAskPage
        content={SAMPLE_CONTENT}
        quota={SAMPLE_QUOTA}
        actionResult={{
          ok: true,
          pending: true,
          mode: 'qa',
          submittedText: 'Fail mid-flight.',
          attemptId,
          turnState: {
            attemptId,
            status: 'running',
            mode: 'qa',
            correlationId: 'corr-pending-start',
            leaseExpiresAt: '2026-11-24T22:01:00Z',
            expiresAt: '2026-11-24T22:15:00Z',
            quota: { ...SAMPLE_QUOTA, turnsUsed: 1, tokensUsed: 512 },
          },
        }}
        isSubmitting={false}
        onSubmitAsk={onSubmitAsk}
        onClose={vi.fn<() => void>()}
      />,
    );

    await waitFor(
      () => {
        expect(screen.getByTestId('ask-error-banner')).toBeTruthy();
      },
      { timeout: 2_500 },
    );

    expect(screen.queryByTestId('ask-turn-pending')).toBeNull();
    expect(screen.getByTestId('ask-error-banner').textContent).toContain(
      'Upstream inference failed cleanly.',
    );
    expect(screen.getByText('0/5 turns')).toBeTruthy();

    fireEvent.click(screen.getByTestId('ask-starter-0'));
    const submitBtn = screen.getByTestId('ask-qa-submit') as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(false);
    fireEvent.click(submitBtn);
    expect(onSubmitAsk).toHaveBeenCalledTimes(1);
  });

  it('does not eagerly poll /api/ask/turns right on same-mount submit before POST settles or returns 202', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
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

    fireEvent.click(screen.getByTestId('ask-starter-0'));
    fireEvent.click(screen.getByTestId('ask-qa-submit'));

    expect(onSubmitAsk).toHaveBeenCalledTimes(1);
    expect(window.sessionStorage.getItem(ASK_TURN_STORAGE_KEY)).toContain(
      onSubmitAsk.mock.calls[0]?.[0]?.attemptId ?? '',
    );
    expect(fetchSpy).not.toHaveBeenCalled();
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

  it('streams multi-turn Q&A via streamEndpoint, switches visitor lenses, and resets conversation cleanly', async () => {
    const encoder = new TextEncoder();
    const sseBody = [
      'event: status\ndata: {"stage":"retrieving","label":"Searching portfolio records..."}\n\n',
      'event: meta\ndata: {"attemptId":"88888888-8888-4888-8888-888888888888","conversationId":"99999999-9999-4999-8999-999999999999","turnIndex":1,"correlationId":"corr-s1","mode":"qa","provider":"local-llama-swap"}\n\n',
      'event: sources\ndata: {"sources":[{"id":"dossier:profile#0","docKey":"dossier:profile","title":"Andrew Klapper Profile","sectionHeading":"Summary","snippet":"Principal engineer.","score":1,"category":"career_dossier"}]}\n\n',
      'event: delta\ndata: {"text":"Andrew focuses on Cloud Run SSR and Go microservices."}\n\n',
      'event: done\ndata: {"attemptId":"88888888-8888-4888-8888-888888888888","conversationId":"99999999-9999-4999-8999-999999999999","turnIndex":1,"grounded":true,"abstained":false,"groundingTier":"profile","answer":"Andrew focuses on Cloud Run SSR and Go microservices.","suggestedLinks":[{"route":"/contact","label":"Contact Andrew","reason":"Reach out directly."}],"followUpQuestions":["How does Andrew handle migrations?"],"provider":"local-llama-swap","model":"gemma-4","tokensUsed":95,"latencyMs":120,"correlationId":"corr-s1","quota":{"role":"guest","turnsUsed":1,"maxTurns":10,"tokensUsed":95,"maxTokens":40000}}\n\n',
    ].join('');

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(encoder.encode(sseBody));
            controller.close();
          },
        }),
        { status: 200, headers: { 'content-type': 'text/event-stream; charset=utf-8' } },
      ),
    );

    render(
      <PortalAskPage
        content={SAMPLE_CONTENT}
        quota={{ ...SAMPLE_QUOTA, maxTurns: 10 }}
        streamEndpoint='/api/ask/stream'
        isSubmitting={false}
        onSubmitAsk={vi.fn<PortalAskPageProps['onSubmitAsk']>()}
        onClose={vi.fn<() => void>()}
      />,
    );

    // Deterministic empty conversationId during SSR/initial mount prevents React 19 hydration mismatches
    expect(screen.getByTestId('ask-workspace').getAttribute('data-conversation-id')).toBe('');

    // Clicking a visitor lens updates selection and reveals lens starter chips
    fireEvent.click(screen.getByTestId('ask-lens-engineering-peer'));
    expect(screen.getByTestId('ask-lens-engineering-peer').getAttribute('aria-pressed')).toBe(
      'true',
    );
    fireEvent.click(screen.getByTestId('ask-starter-0'));
    fireEvent.click(screen.getByTestId('ask-qa-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('ask-qa-transcript')).toBeTruthy();
    });
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/ask/stream',
      expect.objectContaining({ method: 'POST', credentials: 'same-origin' }),
    );
    expect(screen.getByText('Andrew focuses on Cloud Run SSR and Go microservices.')).toBeTruthy();
    expect(screen.getByText('1/10 turns')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Contact Andrew/i })).toBeTruthy();

    // New Conversation clears transcript and rotates conversationId
    const prevConvId = screen.getByTestId('ask-workspace').getAttribute('data-conversation-id');
    fireEvent.click(screen.getByTestId('ask-new-conversation'));
    expect(screen.queryByTestId('ask-qa-transcript')).toBeNull();
    expect(screen.getByTestId('ask-workspace').getAttribute('data-conversation-id')).not.toBe(
      prevConvId,
    );
  });

  it('renders GENERAL pill, conversational status badge, and suppresses boundaryFallbackNotice for general turns while preserving ABSTAINED for boundary turns', async () => {
    const encoder = new TextEncoder();
    const generalSse = [
      'event: status\ndata: {"stage":"generating","label":"Chatting with Andrew\'s AI..."}\n\n',
      'event: sources\ndata: {"sources":[]}\n\n',
      'event: delta\ndata: {"text":"Hey there! Happy to chat."}\n\n',
      'event: done\ndata: {"attemptId":"11111111-1111-4111-8111-111111111101","conversationId":"22222222-2222-4222-8222-222222222201","turnIndex":1,"grounded":false,"abstained":false,"groundingTier":"general","answer":"Hey there! Happy to chat.","sources":[],"suggestedLinks":[],"followUpQuestions":[],"provider":"local-llama-swap","model":"gemma-4","tokensUsed":25,"latencyMs":80,"correlationId":"corr-gen-1"}\n\n',
    ].join('');

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(encoder.encode(generalSse));
            controller.close();
          },
        }),
        { status: 200, headers: { 'content-type': 'text/event-stream; charset=utf-8' } },
      ),
    );

    render(
      <PortalAskPage
        content={SAMPLE_CONTENT}
        quota={SAMPLE_QUOTA}
        streamEndpoint='/api/ask/stream'
        isSubmitting={false}
        onSubmitAsk={vi.fn<PortalAskPageProps['onSubmitAsk']>()}
        onClose={vi.fn<() => void>()}
      />,
    );

    fireEvent.change(screen.getByTestId('ask-question-input'), {
      target: { value: 'Hey there, how is your day going?' },
    });
    fireEvent.click(screen.getByTestId('ask-qa-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('ask-qa-entry')).toBeTruthy();
    });
    const entry = screen.getByTestId('ask-qa-entry');
    expect(entry.getAttribute('data-grounding-tier')).toBe('general');
    expect(entry.textContent).toContain('GENERAL');
    expect(entry.textContent).not.toContain('ABSTAINED');
    expect(entry.textContent).not.toContain(SAMPLE_CONTENT.boundaryFallbackNotice);
    expect(entry.textContent).not.toContain(SAMPLE_CONTENT.contactCtaLabel);
    expect(screen.getByText('general · conversational')).toBeTruthy();
  });

  it('holds loading until first preamble token, renders preamble above Live Retrieved Sources, and clears ephemeral preamble on done', async () => {
    const encoder = new TextEncoder();
    let streamController!: ReadableStreamDefaultController<Uint8Array>;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        streamController = controller;
      },
    });

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(stream, {
        status: 200,
        headers: { 'content-type': 'text/event-stream; charset=utf-8' },
      }),
    );

    render(
      <PortalAskPage
        content={SAMPLE_CONTENT}
        quota={SAMPLE_QUOTA}
        streamEndpoint='/api/ask/stream'
        isSubmitting={false}
        onSubmitAsk={vi.fn<PortalAskPageProps['onSubmitAsk']>()}
        onClose={vi.fn<() => void>()}
      />,
    );

    fireEvent.click(screen.getByTestId('ask-starter-0'));
    fireEvent.click(screen.getByTestId('ask-qa-submit'));

    // Status + meta arrive with no preamble token yet -> loading state remains active
    await act(async () => {
      streamController.enqueue(
        encoder.encode(
          'event: status\ndata: {"stage":"retrieving","label":"Searching portfolio records..."}\n\n' +
            'event: meta\ndata: {"attemptId":"11111111-1111-4111-8111-111111111111","conversationId":"22222222-2222-4222-8222-222222222222","turnIndex":1,"correlationId":"corr-p1","mode":"qa","provider":"local-llama-swap"}\n\n',
        ),
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('ask-preamble-loading')).toBeTruthy();
    });
    expect(screen.queryByTestId('ask-preamble-feed')).toBeNull();

    // Preamble arrives -> loading clears and preamble renders above Live Retrieved Sources
    await act(async () => {
      streamController.enqueue(
        encoder.encode(
          'event: preamble\ndata: {"text":"Checking Andrew\'s Cloud Run and GKE notes now."}\n\n',
        ),
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('ask-preamble-feed').textContent).toContain(
        "Checking Andrew's Cloud Run and GKE notes now.",
      );
    });
    expect(screen.queryByTestId('ask-preamble-loading')).toBeNull();

    // Sources arrive while preamble is still mounted -> preamble sits strictly above Live Retrieved Sources
    await act(async () => {
      streamController.enqueue(
        encoder.encode(
          'event: sources\ndata: {"sources":[{"id":"doc-1","title":"Cloud Run + GKE","snippet":"Hybrid topology.","score":0.94,"category":"architecture"}]}\n\n',
        ),
      );
    });

    await waitFor(() => {
      expect(screen.getByText('Live Retrieved Sources')).toBeTruthy();
    });
    const feedContainer = screen.getByTestId('ask-streaming-feed');
    const preambleNode = screen.getByTestId('ask-preamble-feed');
    const sourcesHeading = screen.getByText('Live Retrieved Sources');
    expect(
      Boolean(
        preambleNode.compareDocumentPosition(sourcesHeading) & Node.DOCUMENT_POSITION_FOLLOWING,
      ),
    ).toBe(true);
    expect(feedContainer.contains(preambleNode)).toBe(true);

    // Delta and done arrive -> completed transcript shows grounded answer only
    await act(async () => {
      streamController.enqueue(
        encoder.encode(
          'event: delta\ndata: {"text":"Andrew runs Cloud Run SSR backed by GKE Autopilot."}\n\n' +
            'event: done\ndata: {"attemptId":"11111111-1111-4111-8111-111111111111","conversationId":"22222222-2222-4222-8222-222222222222","turnIndex":1,"grounded":true,"abstained":false,"groundingTier":"evidence","answer":"Andrew runs Cloud Run SSR backed by GKE Autopilot.","provider":"local-llama-swap","model":"gemma-4","tokensUsed":110,"latencyMs":90,"correlationId":"corr-p1"}\n\n',
        ),
      );
      streamController.close();
    });

    await waitFor(() => {
      expect(screen.getByTestId('ask-qa-entry')).toBeTruthy();
    });
    expect(screen.queryByTestId('ask-preamble-feed')).toBeNull();
    const entry = screen.getByTestId('ask-qa-entry');
    expect(entry.textContent).toContain('Andrew runs Cloud Run SSR backed by GKE Autopilot.');
    expect(entry.textContent).not.toContain("Checking Andrew's Cloud Run and GKE notes now.");
  });

  it('kills loading state on preamble_error, shows non-technical message, and completes RAG + main synthesis', async () => {
    const encoder = new TextEncoder();
    let streamController!: ReadableStreamDefaultController<Uint8Array>;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        streamController = controller;
      },
    });

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(stream, {
        status: 200,
        headers: { 'content-type': 'text/event-stream; charset=utf-8' },
      }),
    );

    render(
      <PortalAskPage
        content={SAMPLE_CONTENT}
        quota={SAMPLE_QUOTA}
        streamEndpoint='/api/ask/stream'
        isSubmitting={false}
        onSubmitAsk={vi.fn<PortalAskPageProps['onSubmitAsk']>()}
        onClose={vi.fn<() => void>()}
      />,
    );

    fireEvent.click(screen.getByTestId('ask-starter-0'));
    fireEvent.click(screen.getByTestId('ask-qa-submit'));

    await act(async () => {
      streamController.enqueue(
        encoder.encode(
          'event: preamble_error\ndata: {"code":"ERR_STREAM_TIMEOUT","message":"Quick preview timed out while searching portfolio records.","action":"Wait for the grounded answer below.","correlationId":"corr-pe1"}\n\n',
        ),
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('ask-preamble-error').textContent).toContain(
        'Quick preview timed out while searching portfolio records.',
      );
    });
    expect(screen.queryByTestId('ask-preamble-loading')).toBeNull();

    await act(async () => {
      streamController.enqueue(
        encoder.encode(
          'event: sources\ndata: {"sources":[{"id":"doc-2","title":"GKE Services","snippet":"Go microservices.","score":0.9,"category":"backend"}]}\n\n' +
            'event: delta\ndata: {"text":"Grounded answer still completes cleanly."}\n\n' +
            'event: done\ndata: {"attemptId":"11111111-1111-4111-8111-111111111112","conversationId":"22222222-2222-4222-8222-222222222223","turnIndex":1,"grounded":true,"abstained":false,"groundingTier":"evidence","answer":"Grounded answer still completes cleanly.","provider":"local-llama-swap","model":"gemma-4","tokensUsed":95,"latencyMs":110,"correlationId":"corr-pe1"}\n\n',
        ),
      );
      streamController.close();
    });

    await waitFor(() => {
      expect(screen.getByText('Grounded answer still completes cleanly.')).toBeTruthy();
    });
  });

  it('retains Live Retrieved Sources alongside error banner when terminal error occurs after sources', async () => {
    const encoder = new TextEncoder();
    const sseBody = [
      'event: sources\ndata: {"sources":[{"id":"doc-r1","title":"Retrieved Source One","snippet":"First snippet.","score":0.95,"category":"architecture"},{"id":"doc-r2","title":"Retrieved Source Two","snippet":"Second snippet.","score":0.88,"category":"backend"}]}\n\n',
      'event: error\ndata: {"code":"ERR_UPSTREAM_UNAVAILABLE","status":502,"message":"Upstream service unreachable.","action":"Retry shortly or go home.","correlationId":"corr-post-src-err"}\n\n',
    ].join('');

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(encoder.encode(sseBody));
            controller.close();
          },
        }),
        { status: 200, headers: { 'content-type': 'text/event-stream; charset=utf-8' } },
      ),
    );

    render(
      <PortalAskPage
        content={SAMPLE_CONTENT}
        quota={SAMPLE_QUOTA}
        streamEndpoint='/api/ask/stream'
        isSubmitting={false}
        onSubmitAsk={vi.fn<PortalAskPageProps['onSubmitAsk']>()}
        onClose={vi.fn<() => void>()}
      />,
    );

    fireEvent.click(screen.getByTestId('ask-starter-0'));
    fireEvent.click(screen.getByTestId('ask-qa-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('ask-error-banner')).toBeTruthy();
    });
    expect(screen.getByTestId('ask-failed-sources')).toBeTruthy();
    expect(screen.getByText('Retrieved Source One')).toBeTruthy();
    expect(screen.getByText('Retrieved Source Two')).toBeTruthy();
  });

  it('aborts cleanly on Cancel mid-preamble and safely ignores preamble frames for legacy callers', async () => {
    const encoder = new TextEncoder();
    const legacySse = [
      'event: status\ndata: {"stage":"retrieving","label":"Searching..."}\n\n',
      'event: preamble\ndata: {"text":"Ephemeral preamble"}\n\n',
      'event: preamble_error\ndata: {"code":"ERR_STREAM_TIMEOUT","message":"Timed out.","correlationId":"corr-leg"}\n\n',
      'event: sources\ndata: {"sources":[]}\n\n',
      'event: delta\ndata: {"text":"Main grounded text."}\n\n',
      'event: done\ndata: {"attemptId":"11111111-1111-4111-8111-111111111113","grounded":false,"abstained":false,"answer":"Main grounded text.","provider":"local-llama-swap","tokensUsed":40,"correlationId":"corr-leg"}\n\n',
    ].join('');

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(encoder.encode(legacySse));
            controller.close();
          },
        }),
        { status: 200, headers: { 'content-type': 'text/event-stream; charset=utf-8' } },
      ),
    );

    let receivedDelta = '';
    let receivedAnswer = '';
    await streamAskQuestion({
      url: '/api/ask/stream',
      question: 'Test legacy compatibility',
      attemptId: '11111111-1111-4111-8111-111111111113',
      conversationId: '22222222-2222-4222-8222-222222222224',
      signal: new AbortController().signal,
      onStatus: () => undefined,
      onMeta: () => undefined,
      onSources: () => undefined,
      onDelta: text => {
        receivedDelta += text;
      },
      onDone: res => {
        receivedAnswer = res.answer;
      },
      onError: () => {
        throw new Error('unexpected error');
      },
    });
    expect(receivedDelta).toBe('Main grounded text.');
    expect(receivedAnswer).toBe('Main grounded text.');

    // Cancel mid-preamble resets loading and preamble state
    let cancelController!: ReadableStreamDefaultController<Uint8Array>;
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            cancelController = controller;
          },
        }),
        { status: 200, headers: { 'content-type': 'text/event-stream; charset=utf-8' } },
      ),
    );

    render(
      <PortalAskPage
        content={SAMPLE_CONTENT}
        quota={SAMPLE_QUOTA}
        streamEndpoint='/api/ask/stream'
        isSubmitting={false}
        onSubmitAsk={vi.fn<PortalAskPageProps['onSubmitAsk']>()}
        onClose={vi.fn<() => void>()}
      />,
    );

    fireEvent.click(screen.getByTestId('ask-starter-0'));
    fireEvent.click(screen.getByTestId('ask-qa-submit'));
    await act(async () => {
      cancelController.enqueue(
        encoder.encode('event: preamble\ndata: {"text":"Starting quick preview..."}\n\n'),
      );
    });
    await waitFor(() => {
      expect(screen.getByTestId('ask-preamble-feed')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('ask-stream-cancel'));
    expect(screen.queryByTestId('ask-preamble-feed')).toBeNull();
    expect(screen.queryByTestId('ask-streaming-feed')).toBeNull();
  });

  it('isolates askTurnRecovery storage and ownership across concurrent primary and secondary chat instances', async () => {
    const primaryAttemptId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    writePersistedAskTurn({
      attemptId: primaryAttemptId,
      mode: 'qa',
      question: 'Primary chat turn in flight',
      ownerInstanceId: 'primary:/chat',
    });

    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const secondarySubmitSpy = vi.fn<PortalAskPageProps['onSubmitAsk']>();

    // Secondary chat pane with different instanceId must NOT hijack or poll primary's persisted turn
    render(
      <PortalAskPage
        instanceId='pane:pane-2'
        content={SAMPLE_CONTENT}
        quota={SAMPLE_QUOTA}
        isSubmitting={false}
        actionResult={{
          ok: false,
          mode: 'qa',
          error: 'Secondary pane settled error',
        }}
        onSubmitAsk={secondarySubmitSpy}
        onClose={vi.fn<() => void>()}
      />,
    );

    await Promise.resolve();
    expect(fetchSpy).not.toHaveBeenCalled();

    // Starting a concurrent turn in pane:pane-2 writes to its own scoped storage key without overwriting primary:/chat
    const qaInput = screen.getByTestId('ask-question-input');
    fireEvent.change(qaInput, {
      target: { value: 'Secondary pane concurrent question about Cloud Run?' },
    });
    fireEvent.click(screen.getByTestId('ask-qa-submit'));

    expect(secondarySubmitSpy).toHaveBeenCalledTimes(1);
    expect(window.sessionStorage.getItem(resolveAskTurnStorageKey('primary:/chat'))).toBeTruthy();
    expect(window.sessionStorage.getItem(resolveAskTurnStorageKey('pane:pane-2'))).toBeTruthy();
    expect(readPersistedAskTurn('primary:/chat')).toEqual({
      attemptId: primaryAttemptId,
      mode: 'qa',
      question: 'Primary chat turn in flight',
      ownerInstanceId: 'primary:/chat',
    });
    expect(readPersistedAskTurn('pane:pane-2')).toMatchObject({
      mode: 'qa',
      question: 'Secondary pane concurrent question about Cloud Run?',
      ownerInstanceId: 'pane:pane-2',
    });

    // Clearing pane:pane-2 leaves primary:/chat completely intact
    clearPersistedAskTurn('pane:pane-2');
    expect(readPersistedAskTurn('pane:pane-2')).toBeNull();
    expect(readPersistedAskTurn('primary:/chat')).toEqual({
      attemptId: primaryAttemptId,
      mode: 'qa',
      question: 'Primary chat turn in flight',
      ownerInstanceId: 'primary:/chat',
    });

    // Clearing primary:/chat removes its scoped entry cleanly
    clearPersistedAskTurn('primary:/chat');
    expect(readPersistedAskTurn('primary:/chat')).toBeNull();
  });
});
