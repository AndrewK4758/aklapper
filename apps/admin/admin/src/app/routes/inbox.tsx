import type { AdminInboxLoaderData } from '@aklapper/core';
import { deleteContactSubmission, getSharedDb, listContactSubmissions } from '@aklapper/db';
import {
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  type MetaArgs,
  useActionData,
  useLoaderData,
} from 'react-router';

import { type AdminInboxActionData, AdminInboxPage } from '#pages/inbox';

import { requireAdminSession } from '../admin-ops.server';
import { buildAdminPageMeta } from '../seo';

export async function loader({ request }: LoaderFunctionArgs): Promise<AdminInboxLoaderData> {
  await requireAdminSession(request);
  const url = new URL(request.url);
  const query = url.searchParams.get('q') ?? '';
  const rawPage = Number.parseInt(url.searchParams.get('page') ?? '1', 10);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;

  return listContactSubmissions(getSharedDb(), { query, page, pageSize: 20 });
}

export async function action({ request }: ActionFunctionArgs): Promise<AdminInboxActionData> {
  await requireAdminSession(request);
  const formData = await request.formData();
  const intent = String(formData.get('intent') ?? '');

  if (intent === 'delete') {
    const id = String(formData.get('id') ?? '').trim();
    const deleted = await deleteContactSubmission(getSharedDb(), id);
    return deleted
      ? { ok: true, message: 'Contact submission deleted from PostgreSQL 19.' }
      : { ok: false, message: 'Submission not found or already deleted.' };
  }

  return { ok: false, message: `Unsupported inbox action: ${intent}` };
}

export function meta({ matches, location }: MetaArgs<typeof loader>) {
  return buildAdminPageMeta({
    matches,
    pathname: location.pathname,
    title: 'Contact Inbox // admin.andrew-k.us',
    description: 'Search, inspect, download verified attachments, and manage contact submissions.',
  });
}

export default function AdminInboxRoute() {
  const data = useLoaderData() as AdminInboxLoaderData;
  const actionData = useActionData() as AdminInboxActionData | undefined;
  return <AdminInboxPage data={data} actionData={actionData ?? null} />;
}
