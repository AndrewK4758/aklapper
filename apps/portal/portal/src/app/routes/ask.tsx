import {
  type AskMode,
  AskResponseSchema,
  type PortalAskLoaderData,
  type QuotaStatus,
  QuotaStatusSchema,
} from '@aklapper/core';
import {
  consumeQuotaForSession,
  getSharedDb,
  loadPortalAskDataWithPrerender,
  searchPortfolioCorpusFallback,
} from '@aklapper/db';
import { proxyJson } from '@aklapper/node-runtime/http';
import { usePaneNavigation } from '@aklapper/ui';
import {
  type ActionFunctionArgs,
  data,
  type LoaderFunctionArgs,
  type MetaArgs,
  useFetcher,
  useLoaderData,
  useNavigate,
} from 'react-router';

import { type PortalAskActionResult, PortalAskPage } from '#pages/ask';

import { resolveGuestSession } from '../guest-session.server';
import { buildPortalPageMeta } from '../seo';

export async function loader({ request }: LoaderFunctionArgs) {
  const { sessionId, setCookieHeader } = resolveGuestSession(request);
  const payload = await loadPortalAskDataWithPrerender(sessionId);
  return data<PortalAskLoaderData>(
    payload,
    setCookieHeader ? { headers: { 'Set-Cookie': setCookieHeader } } : undefined,
  );
}

export async function action({ request }: ActionFunctionArgs) {
  const { sessionId, setCookieHeader } = resolveGuestSession(request);
  const headers = setCookieHeader ? { 'Set-Cookie': setCookieHeader } : undefined;
  const formData = await request.formData();

  const rawMode = String(formData.get('mode') ?? 'qa').trim();
  const mode: AskMode = rawMode === 'jd_match' ? 'jd_match' : 'qa';
  const text = String(formData.get('text') ?? '').trim();

  if (mode === 'qa' && (text.length < 4 || text.length > 800)) {
    return data<PortalAskActionResult>(
      { ok: false, mode, error: 'Question must be between 4 and 800 characters.' },
      { status: 400, headers },
    );
  }
  if (mode === 'jd_match' && (text.length < 20 || text.length > 8000)) {
    return data<PortalAskActionResult>(
      { ok: false, mode, error: 'Job description must be between 20 and 8000 characters.' },
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
  const db = getSharedDb();
  const quotaCheck = await consumeQuotaForSession(db, 'guest', sessionId, 1, 512);
  const quotaStatus: QuotaStatus = quotaCheck.quota;
  if (!quotaCheck.allowed) {
    return data<PortalAskActionResult>(
      {
        ok: false,
        mode,
        error: 'Session or daily guest quota exceeded. Try again later.',
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
}

export function meta({ loaderData, matches, location }: MetaArgs<typeof loader>) {
  return buildPortalPageMeta({
    matches,
    pathname: location.pathname,
    title: 'Ask Portfolio & JD Match // andrew-k.us',
    description:
      loaderData?.content.description ??
      'Grounded portfolio RAG Q&A and Job Description matcher with strict abstention.',
  });
}

export default function PortalAskRoute() {
  const { content, quota } = useLoaderData() as PortalAskLoaderData;
  const fetcher = useFetcher<PortalAskActionResult>();
  const navigate = useNavigate();
  const paneNav = usePaneNavigation();

  return (
    <PortalAskPage
      content={content}
      quota={quota}
      actionResult={fetcher.data}
      isSubmitting={fetcher.state !== 'idle'}
      onSubmitAsk={({ mode, text }) => {
        void fetcher.submit({ mode, text }, { method: 'post', action: '/ask' });
      }}
      onClose={() => {
        if (paneNav?.docked) {
          paneNav.exitTui();
        } else {
          void navigate('/');
        }
      }}
    />
  );
}
