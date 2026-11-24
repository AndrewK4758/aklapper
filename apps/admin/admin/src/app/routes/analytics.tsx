import { type AdminAnalyticsLoaderData, AdminAnalyticsWindowSchema } from '@aklapper/core';
import { loadAdminAnalyticsDataWithPrerender } from '@aklapper/db';
import { type LoaderFunctionArgs, type MetaArgs, useLoaderData } from 'react-router';

import { AdminAnalyticsPage } from '#pages/analytics';

import { buildAdminPageMeta } from '../seo';

export async function loader({ request }: LoaderFunctionArgs): Promise<AdminAnalyticsLoaderData> {
  const url = new URL(request.url);
  const parsedWindow = AdminAnalyticsWindowSchema.safeParse(url.searchParams.get('window'));
  const window = parsedWindow.success ? parsedWindow.data : '7d';
  return loadAdminAnalyticsDataWithPrerender(window);
}

export function meta({ loaderData, matches, location }: MetaArgs<typeof loader>) {
  return buildAdminPageMeta({
    matches,
    pathname: location.pathname,
    title: 'Analytics Telemetry // admin.andrew-k.us',
    description:
      loaderData?.content.description ??
      'First-party visitor analytics, Core Web Vitals percentiles, and Agensi conversion metrics.',
  });
}

export default function AdminAnalyticsRoute() {
  const data = useLoaderData() as AdminAnalyticsLoaderData;
  return <AdminAnalyticsPage data={data} />;
}
