import type { AdminOverviewLoaderData } from '@aklapper/core';
import { getSharedDb, loadAdminOverviewData } from '@aklapper/db';
import { resolveAdminSessionFromRequest } from '@aklapper/db/auth';
import { type LoaderFunctionArgs, type MetaArgs, useLoaderData } from 'react-router';

import { AdminHomePage } from '#pages/home';
import { createPasskeyCredential, type RegistrationOptionsJSON } from '#pages/login';

import { buildOverviewHealthSummary } from '../admin-ops.server';
import { buildAdminPageMeta } from '../seo';

export async function loader({ request }: LoaderFunctionArgs): Promise<AdminOverviewLoaderData> {
  const [authStatus, health] = await Promise.all([
    resolveAdminSessionFromRequest(request),
    buildOverviewHealthSummary(),
  ]);

  const db = getSharedDb();
  return loadAdminOverviewData(db, {
    handle: authStatus.session?.handle ?? 'admin',
    passkeyCount: authStatus.passkeyCount,
    totpEnabled: authStatus.totpEnabled,
    ...health,
  });
}

export function meta({ loaderData, matches, location }: MetaArgs<typeof loader>) {
  return buildAdminPageMeta({
    matches,
    pathname: location.pathname,
    title: 'Andrew Klapper Admin',
    description:
      loaderData?.content.description ??
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

export default function AdminHomeRoute() {
  const data = useLoaderData() as AdminOverviewLoaderData;
  return <AdminHomePage data={data} onRegisterPasskey={registerAdditionalPasskey} />;
}
