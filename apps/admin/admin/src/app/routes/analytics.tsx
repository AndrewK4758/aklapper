import type { AdminAnalyticsLoaderData } from '@aklapper/core';
import { loadAdminAnalyticsDataWithPrerender } from '@aklapper/db';
import { type MetaArgs, useLoaderData } from 'react-router';

import { AdminAnalyticsPage } from '#pages/analytics';

import { buildAdminPageMeta } from '../seo';

export async function loader(): Promise<AdminAnalyticsLoaderData> {
  return loadAdminAnalyticsDataWithPrerender();
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
  const { content, summary } = useLoaderData() as AdminAnalyticsLoaderData;
  return <AdminAnalyticsPage content={content} summary={summary} />;
}
