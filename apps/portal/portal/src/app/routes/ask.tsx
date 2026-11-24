import {
  type AskMode,
  AskResponseSchema,
  type PortalAskLoaderData,
  type QuotaStatus,
  QuotaStatusSchema,
} from '@aklapper/core';
import { classifyServerError } from '@aklapper/core/server-errors';
import {
  consumeQuotaForSession,
  getSharedDb,
  loadPortalAskDataWithPrerender,
  searchPortfolioCorpusFallback,
} from '@aklapper/db';
import { proxyJson } from '@aklapper/node-runtime/http';
import {
  createFallbackLogger,
  deferStreamResult,
  getOrCreateCorrelationId,
  getRequestContext,
  logDiagnosticError,
} from '@aklapper/node-runtime/ssr/stream';
import { RouteErrorBoundaryView, SuspenseElement, usePaneNavigation } from '@aklapper/ui';
import { data, href, useFetcher, useNavigate } from 'react-router';

import { type PortalAskActionResult, PortalAskPage } from '#pages/ask';

import { reportPortalPublicError } from '../client-telemetry';
import { resolveGuestSession } from '../guest-session.server';
import { buildPortalPageMeta } from '../seo';
import type { Route } from './+types/ask';

export function loader({ request, context }: Route.LoaderArgs) {
  const { sessionId, setCookieHeader } = resolveGuestSession(request);
  const correlationId = getOrCreateCorrelationId(request, context);
  return data(
    {
      correlationId,
      payload: deferStreamResult(loadPortalAskDataWithPrerender(sessionId), {
        request,
        context,
        source: 'portal.ask.loader',
      }),
    },
    setCookieHeader ? { headers: { 'Set-Cookie': setCookieHeader } } : undefined,
  );
}

export async function action({ request, context }: Route.ActionArgs) {
  const { sessionId, setCookieHeader } = resolveGuestSession(request);
  const reqCtx = getRequestContext(context);
  const correlationId = getOrCreateCorrelationId(request, context);
  const logger = reqCtx?.logger ?? createFallbackLogger('portal-ask');
  const headers: Record<string, string> = {
    'X-Correlation-Id': correlationId,
    ...(setCookieHeader ? { 'Set-Cookie': setCookieHeader } : {}),
  };

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return data<PortalAskActionResult>(
      {
        ok: false,
        mode: 'qa',
        error: 'Malformed ask submission payload.',
        code: 'ERR_VALIDATION',
        action: 'Review your question and retry.',
        correlationId,
      },
      { status: 400, headers },
    );
  }

  const rawMode = String(formData.get('mode') ?? 'qa').trim();
  const mode: AskMode = rawMode === 'jd_match' ? 'jd_match' : 'qa';
  const text = String(formData.get('text') ?? '').trim();

  if (mode === 'qa' && (text.length < 4 || text.length > 800)) {
    return data<PortalAskActionResult>(
      {
        ok: false,
        mode,
        error: 'Question must be between 4 and 800 characters.',
        code: 'ERR_VALIDATION',
        correlationId,
      },
      { status: 400, headers },
    );
  }
  if (mode === 'jd_match' && (text.length < 20 || text.length > 8000)) {
    return data<PortalAskActionResult>(
      {
        ok: false,
        mode,
        error: 'Job description must be between 20 and 8000 characters.',
        code: 'ERR_VALIDATION',
        correlationId,
      },
      { status: 400, headers },
    );
  }

  const aiAskUrl = process.env['AI_ASK_URL']?.trim();
  if (aiAskUrl) {
    const upstream = await proxyJson<Record<string, unknown>>({
      baseUrl: aiAskUrl,
      path: '/v1/ask',
      method: 'POST',
      body:
        mode === 'qa'
          ? { mode, question: text, sessionId }
          : { mode, jobDescription: text, sessionId },
      timeoutMs: 8_000,
    });

    if (upstream.status === 429) {
      const parsedQuota = QuotaStatusSchema.safeParse(upstream.data?.['quota']);
      return data<PortalAskActionResult>(
        {
          ok: false,
          mode,
          error:
            typeof upstream.data?.['error'] === 'string'
              ? upstream.data['error']
              : 'Session or daily quota exceeded.',
          code: 'ERR_RATE_LIMITED',
          action: 'Wait a moment and submit again.',
          correlationId,
          ...(parsedQuota.success ? { quota: parsedQuota.data } : {}),
        },
        { status: 429, headers },
      );
    }

    if (upstream.ok && upstream.data) {
      const parsed = AskResponseSchema.safeParse(upstream.data);
      if (parsed.success) {
        return data<PortalAskActionResult>(
          { ok: true, mode, submittedText: text, response: parsed.data },
          { status: 200, headers },
        );
      }
    }
  }

  // Deterministic PG19-backed fallback when AI_ASK_URL is unset or unreachable.
  try {
    const db = getSharedDb();
    const quotaCheck = await consumeQuotaForSession(db, 'guest', sessionId, 1, 512);
    const quotaStatus: QuotaStatus = quotaCheck.quota;
    if (!quotaCheck.allowed) {
      return data<PortalAskActionResult>(
        {
          ok: false,
          mode,
          error: 'Session or daily guest quota exceeded. Try again later.',
          code: 'ERR_RATE_LIMITED',
          action: 'Wait a moment and submit again.',
          correlationId,
          quota: quotaStatus,
        },
        { status: 429, headers },
      );
    }

    const fallbackResponse = await searchPortfolioCorpusFallback(db, text, mode, quotaStatus);
    return data<PortalAskActionResult>(
      { ok: true, mode, submittedText: text, response: fallbackResponse },
      { status: 200, headers },
    );
  } catch (error) {
    const { publicError, diagnostic } = classifyServerError(error, {
      correlationId,
      source: 'portal.ask.action',
    });
    logDiagnosticError(logger, diagnostic);
    return data<PortalAskActionResult>(
      {
        ok: false,
        mode,
        error: publicError.message,
        code: publicError.code,
        action: publicError.action,
        correlationId: publicError.correlationId,
      },
      { status: publicError.status, headers },
    );
  }
}

export function meta({ matches, location }: Route.MetaArgs) {
  return buildPortalPageMeta({
    matches,
    pathname: location.pathname,
    title: 'Ask Portfolio & JD Match // andrew-k.us',
    description: 'Grounded portfolio RAG Q&A and Job Description matcher with strict abstention.',
  });
}

export default function PortalAskRoute({ loaderData }: Route.ComponentProps) {
  const fetcher = useFetcher<PortalAskActionResult>();
  const navigate = useNavigate();
  const paneNav = usePaneNavigation();

  return (
    <SuspenseElement<PortalAskLoaderData>
      resolve={loaderData.payload}
      correlationId={loaderData.correlationId}
      homeHref={href('/')}
      loadingLabel='Loading portfolio Q&A...'
      onStreamError={error => {
        reportPortalPublicError(error, { phase: 'stream' });
      }}
    >
      {({ content, quota }) => (
        <PortalAskPage
          content={content}
          quota={quota}
          actionResult={fetcher.data}
          isSubmitting={fetcher.state !== 'idle'}
          onSubmitAsk={({ mode, text }) => {
            void fetcher.submit({ mode, text }, { method: 'post', action: href('/ask') });
          }}
          onClose={() => {
            if (paneNav?.docked) {
              paneNav.exitTui();
            } else {
              void navigate(href('/'));
            }
          }}
        />
      )}
    </SuspenseElement>
  );
}

export function ErrorBoundary({ error, loaderData }: Route.ErrorBoundaryProps) {
  return (
    <RouteErrorBoundaryView
      error={error}
      correlationId={loaderData?.correlationId}
      homeHref={href('/')}
      onError={publicError => {
        reportPortalPublicError(publicError, { phase: 'boundary' });
      }}
    />
  );
}
