import {
  type AdminQuotasLoaderData,
  BucketPurgeSchema,
  BucketResetSchema,
  QuotaPolicyUpdateSchema,
} from '@aklapper/core';
import {
  getSharedDb,
  listQuotaPoliciesAndBuckets,
  purgeStaleRateLimitBuckets,
  resetRateLimitBucket,
  updateQuotaPolicy,
} from '@aklapper/db';
import {
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  type MetaArgs,
  useActionData,
  useLoaderData,
} from 'react-router';

import { type AdminQuotasActionData, AdminQuotasPage } from '#pages/quotas';

import { requireAdminSession } from '../admin-ops.server';
import { buildAdminPageMeta } from '../seo';

export async function loader({ request }: LoaderFunctionArgs): Promise<AdminQuotasLoaderData> {
  await requireAdminSession(request);
  return listQuotaPoliciesAndBuckets(getSharedDb());
}

export async function action({ request }: ActionFunctionArgs): Promise<AdminQuotasActionData> {
  await requireAdminSession(request);
  const formData = await request.formData();
  const intent = String(formData.get('intent') ?? '');
  const db = getSharedDb();

  try {
    if (intent === 'update-policy') {
      const parsed = QuotaPolicyUpdateSchema.parse({
        role: formData.get('role'),
        maxTurnsPerSession: formData.get('maxTurnsPerSession'),
        maxTokensPerRun: formData.get('maxTokensPerRun'),
        maxDailyGlobalTokens: formData.get('maxDailyGlobalTokens'),
      });
      const updated = await updateQuotaPolicy(db, parsed);
      return {
        ok: true,
        message: `Updated ${updated.role} quota policy (${updated.maxTurnsPerSession} turns, ${updated.maxTokensPerRun} tokens/run).`,
      };
    }

    if (intent === 'reset-bucket') {
      const { scopeKey } = BucketResetSchema.parse({
        scopeKey: formData.get('scopeKey'),
      });
      const deleted = await resetRateLimitBucket(db, scopeKey);
      return deleted
        ? { ok: true, message: `Reset rate-limit bucket ${scopeKey}.` }
        : { ok: false, message: `Bucket ${scopeKey} was not found.` };
    }

    if (intent === 'purge-stale') {
      const { olderThanHours } = BucketPurgeSchema.parse({
        olderThanHours: formData.get('olderThanHours'),
      });
      const count = await purgeStaleRateLimitBuckets(db, olderThanHours);
      return {
        ok: true,
        message: `Purged ${count} stale bucket${count === 1 ? '' : 's'} older than ${olderThanHours}h.`,
      };
    }

    return { ok: false, message: `Unsupported quota intent: ${intent}` };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Quota update failed validation.',
    };
  }
}

export function meta({ matches, location }: MetaArgs<typeof loader>) {
  return buildAdminPageMeta({
    matches,
    pathname: location.pathname,
    title: 'Quotas & Rate Limits // admin.andrew-k.us',
    description: 'Configure guest and admin AI quota policies and reset active rate-limit buckets.',
  });
}

export default function AdminQuotasRoute() {
  const data = useLoaderData() as AdminQuotasLoaderData;
  const actionData = useActionData() as AdminQuotasActionData | undefined;
  return <AdminQuotasPage data={data} actionData={actionData ?? null} />;
}
