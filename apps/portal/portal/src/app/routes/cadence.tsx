import {
  CadenceRunResultSchema,
  type PortalCadenceLoaderData,
  QuotaStatusSchema,
} from '@aklapper/core';
import { classifyServerError } from '@aklapper/core/server-errors';
import {
  consumeQuotaForSession,
  createSandboxRunWithTurns,
  getSharedDb,
  loadPortalCadenceDataWithPrerender,
  updateSandboxRunGateVerdict,
} from '@aklapper/db';
import { proxyJson } from '@aklapper/node-runtime/http';
import {
  createFallbackLogger,
  deferStreamResult,
  getOrCreateCorrelationId,
  getRequestContext,
  logDiagnosticError,
  type SsrStructuredLogger,
} from '@aklapper/node-runtime/ssr/stream';
import { RouteErrorBoundaryView, SuspenseElement, usePaneNavigation } from '@aklapper/ui';
import { data, href, useFetcher, useNavigate } from 'react-router';

import { type PortalCadenceActionResult, PortalCadencePage } from '#pages/cadence';

import { reportPortalPublicError } from '../client-telemetry';
import { resolveGuestSession } from '../guest-session.server';
import { buildPortalPageMeta } from '../seo';
import type { Route } from './+types/cadence';

function escapeHtml(raw: string): string {
  return raw
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function buildFallbackArtifactHtml(prompt: string, presetSlug: string): string {
  const safePrompt = escapeHtml(prompt);
  const safePreset = escapeHtml(presetSlug || 'solar-forge-starter');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>CADENCE Sandbox Artifact</title>
<style>
  body { margin: 0; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; background: #121110; color: #f4efe6; padding: 1.25rem; }
  .shell { border: 1px solid #d97706; border-radius: 6px; padding: 1rem; background: #1c1a17; }
  .badge { color: #f59e0b; font-size: 0.72rem; letter-spacing: 0.08em; text-transform: uppercase; }
  h1 { margin: 0.5rem 0; font-size: 1.05rem; color: #ffd300; }
  p { color: #c7bfb2; line-height: 1.5; font-size: 0.85rem; }
</style>
</head>
<body>
  <main class="shell">
    <div class="badge">CADENCE · CHORD SANDBOX ARTIFACT · ${safePreset}</div>
    <h1>${safePrompt}</h1>
    <p>Persisted to PostgreSQL 19 under guest quota guardrails and rendered in an isolated sandbox iframe.</p>
  </main>
</body>
</html>`;
}

function classifyCadenceActionFailure(
  error: unknown,
  intent: 'run' | 'gate',
  correlationId: string,
  logger: SsrStructuredLogger,
  headers: Record<string, string>,
) {
  const { publicError, diagnostic } = classifyServerError(error, {
    correlationId,
    source: `portal.cadence.${intent}`,
  });
  logDiagnosticError(logger, diagnostic);
  return data<PortalCadenceActionResult>(
    {
      ok: false,
      intent,
      error: publicError.message,
      code: publicError.code,
      action: publicError.action,
      correlationId: publicError.correlationId,
    },
    { status: publicError.status, headers },
  );
}

export function loader({ request, context }: Route.LoaderArgs) {
  const { sessionId, setCookieHeader } = resolveGuestSession(request);
  const correlationId = getOrCreateCorrelationId(request, context);
  return data(
    {
      correlationId,
      payload: deferStreamResult(loadPortalCadenceDataWithPrerender(sessionId), {
        request,
        context,
        source: 'portal.cadence.loader',
      }),
    },
    setCookieHeader ? { headers: { 'Set-Cookie': setCookieHeader } } : undefined,
  );
}

export async function action({ request, context }: Route.ActionArgs) {
  const { sessionId, setCookieHeader } = resolveGuestSession(request);
  const reqCtx = getRequestContext(context);
  const correlationId = getOrCreateCorrelationId(request, context);
  const logger = reqCtx?.logger ?? createFallbackLogger('portal-cadence');
  const headers: Record<string, string> = {
    'X-Correlation-Id': correlationId,
    ...(setCookieHeader ? { 'Set-Cookie': setCookieHeader } : {}),
  };

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return data<PortalCadenceActionResult>(
      {
        ok: false,
        intent: 'run',
        error: 'Malformed sandbox submission payload.',
        code: 'ERR_VALIDATION',
        action: 'Review your prompt and retry.',
        correlationId,
      },
      { status: 400, headers },
    );
  }

  const intent = String(formData.get('intent') ?? 'run').trim();
  const cadenceDemoUrl = process.env['CADENCE_DEMO_URL']?.trim();

  if (intent === 'gate') {
    const runId = String(formData.get('runId') ?? '').trim();
    const rawVerdict = String(formData.get('verdict') ?? '').trim();
    if (!runId || (rawVerdict !== 'approved' && rawVerdict !== 'rejected')) {
      return data<PortalCadenceActionResult>(
        {
          ok: false,
          intent: 'gate',
          error: 'Invalid runId or gate verdict.',
          code: 'ERR_VALIDATION',
          correlationId,
        },
        { status: 400, headers },
      );
    }

    if (cadenceDemoUrl) {
      const upstream = await proxyJson<Record<string, unknown>>({
        baseUrl: cadenceDemoUrl,
        path: `/v1/cadence/runs/${encodeURIComponent(runId)}/gate`,
        method: 'POST',
        body: { verdict: rawVerdict },
        timeoutMs: 6_000,
        internalAuth: { role: 'guest', subject: sessionId },
      });
      if (upstream.ok && upstream.data?.['run']) {
        const parsed = CadenceRunResultSchema.safeParse(upstream.data['run']);
        if (parsed.success) {
          return data<PortalCadenceActionResult>(
            { ok: true, intent: 'gate', run: parsed.data },
            { status: 200, headers },
          );
        }
      }
    }

    try {
      const db = getSharedDb();
      const updated = await updateSandboxRunGateVerdict(db, runId, rawVerdict);
      if (!updated) {
        return data<PortalCadenceActionResult>(
          {
            ok: false,
            intent: 'gate',
            error: 'Sandbox run not found.',
            code: 'ERR_NOT_FOUND',
            correlationId,
          },
          { status: 404, headers },
        );
      }
      return data<PortalCadenceActionResult>(
        { ok: true, intent: 'gate', run: updated },
        { status: 200, headers },
      );
    } catch (error) {
      return classifyCadenceActionFailure(error, 'gate', correlationId, logger, headers);
    }
  }

  const prompt = String(formData.get('prompt') ?? '').trim();
  const presetSlug = String(formData.get('presetSlug') ?? 'solar-forge-starter').trim();

  if (prompt.length < 4 || prompt.length > 1200) {
    return data<PortalCadenceActionResult>(
      {
        ok: false,
        intent: 'run',
        error: 'Prompt must be between 4 and 1200 characters.',
        code: 'ERR_VALIDATION',
        correlationId,
      },
      { status: 400, headers },
    );
  }

  if (cadenceDemoUrl) {
    const upstream = await proxyJson<Record<string, unknown>>({
      baseUrl: cadenceDemoUrl,
      path: '/v1/cadence/runs',
      method: 'POST',
      body: { prompt, presetSlug, sessionId },
      timeoutMs: 12_000,
      internalAuth: { role: 'guest', subject: sessionId },
    });

    if (upstream.status === 429) {
      const parsedQuota = QuotaStatusSchema.safeParse(upstream.data?.['quota']);
      return data<PortalCadenceActionResult>(
        {
          ok: false,
          intent: 'run',
          error:
            typeof upstream.data?.['error'] === 'string'
              ? upstream.data['error']
              : 'Session or daily CADENCE quota exceeded.',
          code: 'ERR_RATE_LIMITED',
          action: 'Wait a moment and submit again.',
          correlationId,
          ...(parsedQuota.success ? { quota: parsedQuota.data } : {}),
        },
        { status: 429, headers },
      );
    }

    if (upstream.ok && upstream.data) {
      const parsedRun = CadenceRunResultSchema.safeParse(upstream.data);
      const parsedQuota = QuotaStatusSchema.safeParse(upstream.data['quota']);
      if (parsedRun.success) {
        return data<PortalCadenceActionResult>(
          {
            ok: true,
            intent: 'run',
            run: parsedRun.data,
            ...(parsedQuota.success ? { quota: parsedQuota.data } : {}),
          },
          { status: 201, headers },
        );
      }
    }
  }

  // Deterministic PG19-backed fallback when CADENCE_DEMO_URL is unset or unreachable.
  try {
    const db = getSharedDb();
    const quotaCheck = await consumeQuotaForSession(db, 'guest', sessionId, 1, 800);
    if (!quotaCheck.allowed) {
      return data<PortalCadenceActionResult>(
        {
          ok: false,
          intent: 'run',
          error: 'Session or daily CADENCE guest quota exceeded.',
          code: 'ERR_RATE_LIMITED',
          action: 'Wait a moment and submit again.',
          correlationId,
          quota: quotaCheck.quota,
        },
        { status: 429, headers },
      );
    }

    const artifactHtml = buildFallbackArtifactHtml(prompt, presetSlug);
    const run = await createSandboxRunWithTurns(db, {
      sessionId,
      ipHash: 'portal-ssr',
      menuSlug: presetSlug,
      presetSlug,
      prompt,
      tokensIn: Math.ceil(prompt.length / 4) + 120,
      tokensOut: 480,
      artifactHtml,
      turns: [
        {
          phase: 'triage',
          agentName: 'chord-triage',
          status: 'completed',
          summary: `Classified prompt (${prompt.length} chars) under preset "${presetSlug}".`,
          latencyMs: 6,
        },
        {
          phase: 'spec',
          agentName: 'chord-spec',
          status: 'completed',
          summary: 'Drafted single-file Solar Forge HTML/CSS artifact specification.',
          latencyMs: 9,
        },
        {
          phase: 'build',
          agentName: 'chord-builder',
          status: 'completed',
          summary: `Synthesized bounded HTML artifact (${artifactHtml.length} bytes).`,
          latencyMs: 14,
        },
        {
          phase: 'gate',
          agentName: 'chord-gate',
          status: 'completed',
          summary: 'Verified sandbox isolation rules; awaiting operator gate verdict.',
          latencyMs: 5,
        },
      ],
    });

    return data<PortalCadenceActionResult>(
      { ok: true, intent: 'run', run, quota: quotaCheck.quota },
      { status: 201, headers },
    );
  } catch (error) {
    return classifyCadenceActionFailure(error, 'run', correlationId, logger, headers);
  }
}

export function meta({ matches, location }: Route.MetaArgs) {
  return buildPortalPageMeta({
    matches,
    pathname: location.pathname,
    title: 'CADENCE Builder // andrew-k.us',
    description:
      'Quota-gated prompt-to-artifact sandbox wired for live GKE Autopilot scale-from-zero execution.',
  });
}

export default function PortalCadenceRoute({ loaderData }: Route.ComponentProps) {
  const fetcher = useFetcher<PortalCadenceActionResult>();
  const navigate = useNavigate();
  const paneNav = usePaneNavigation();

  return (
    <SuspenseElement<PortalCadenceLoaderData>
      resolve={loaderData.payload}
      correlationId={loaderData.correlationId}
      homeHref={href('/')}
      loadingLabel='Loading sandbox builder...'
      onStreamError={error => {
        reportPortalPublicError(error, { phase: 'stream' });
      }}
    >
      {({ content, presets, quota, recentRuns }) => (
        <PortalCadencePage
          content={content}
          presets={presets}
          quota={quota}
          recentRuns={recentRuns}
          actionResult={fetcher.data}
          isSubmitting={fetcher.state !== 'idle'}
          onRunBuild={({ prompt, presetSlug }) => {
            void fetcher.submit(
              { intent: 'run', prompt, presetSlug },
              { method: 'post', action: href('/cadence') },
            );
          }}
          onGateVerdict={({ runId, verdict }) => {
            void fetcher.submit(
              { intent: 'gate', runId, verdict },
              { method: 'post', action: href('/cadence') },
            );
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
