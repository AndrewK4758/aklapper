import type { AdminOverviewLoaderData, StreamResult } from '@aklapper/core';
import { getSharedDb, loadAdminOverviewData } from '@aklapper/db';
import { deferStreamResult, getOrCreateCorrelationId } from '@aklapper/node-runtime/ssr/stream';
import { RouteErrorBoundaryView, SuspenseElement } from '@aklapper/ui';
import { href } from 'react-router';

import { AdminHomePage } from '#pages/home';
import { createPasskeyCredential, type RegistrationOptionsJSON } from '#pages/login';

import { buildOverviewHealthSummary, requireAdminSession } from '../admin-ops.server';
import { reportAdminPublicError } from '../client-telemetry';
import { buildAdminPageMeta } from '../seo';
import type { Route } from './+types/home';

export interface AdminHomeStreamData {
  readonly correlationId: string;
  readonly payload: Promise<StreamResult<AdminOverviewLoaderData>>;
}

export async function loader({ request, context }: Route.LoaderArgs): Promise<AdminHomeStreamData> {
  const correlationId = getOrCreateCorrelationId(request, context);
  const { status, session } = await requireAdminSession(request, {
    context,
    source: 'admin.home.loader',
  });

  return {
    correlationId,
    payload: deferStreamResult(
      (async () => {
        const health = await buildOverviewHealthSummary();
        const db = getSharedDb();
        return loadAdminOverviewData(db, {
          handle: session.handle,
          passkeyCount: status.passkeyCount,
          totpEnabled: status.totpEnabled,
          ...health,
        });
      })(),
      {
        request,
        context,
        source: 'admin.home.loader',
      },
    ),
  };
}

export function meta({ matches, location }: Route.MetaArgs) {
  return buildAdminPageMeta({
    matches,
    pathname: location.pathname,
    title: 'Andrew Klapper Admin',
    description:
      'Isolated operations console for andrew-k.us passkey auth, CMS, inbox, quotas, and telemetry.',
  });
}

async function registerAdditionalPasskey(): Promise<void> {
  const optionsRes = await fetch('/api/auth/passkey/register/options', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({}),
  });
  if (!optionsRes.ok) {
    const err = (await optionsRes.json().catch(() => ({}))) as { message?: string; error?: string };
    throw new Error(err.message ?? err.error ?? 'Failed to start passkey registration.');
  }
  const { challengeId, options } = (await optionsRes.json()) as {
    challengeId: string;
    options: RegistrationOptionsJSON;
  };
  const credential = await createPasskeyCredential(options);
  const verifyRes = await fetch('/api/auth/passkey/register/verify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ challengeId, response: credential }),
  });
  if (!verifyRes.ok) {
    const err = (await verifyRes.json().catch(() => ({}))) as { message?: string; error?: string };
    throw new Error(err.message ?? err.error ?? 'Failed to verify new passkey.');
  }
}

export default function AdminHomeRoute({ loaderData }: Route.ComponentProps) {
  return (
    <SuspenseElement<AdminOverviewLoaderData>
      resolve={loaderData.payload}
      correlationId={loaderData.correlationId}
      homeHref={href('/')}
      loadingLabel='Loading operations overview...'
      onStreamError={error => {
        reportAdminPublicError(error, { phase: 'stream' });
      }}
    >
      {resolved => <AdminHomePage data={resolved} onRegisterPasskey={registerAdditionalPasskey} />}
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
        reportAdminPublicError(publicError, { phase: 'boundary' });
      }}
    />
  );
}
