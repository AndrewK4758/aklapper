import type { AdminAnalyticsLoaderData } from '@aklapper/contracts';
import { loadAdminAnalyticsDataWithPrerender } from '@aklapper/db';
import { Meter, Separator, TuiWindow } from '@aklapper/ui';
import { type MetaArgs, useLoaderData } from 'react-router';

import { buildAdminPageMeta } from '../seo';

import styles from './analytics.module.css';

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
  const eventCap = Math.max(100, summary.totalEvents, summary.totalSessions);

  return (
    <div className={styles.panel}>
      <TuiWindow title={content.windowTitle}>
        <p>{content.description}</p>
        <Separator.Root />
        <p>
          Sessions: <strong>{summary.totalSessions}</strong> · Events:{' '}
          <strong>{summary.totalEvents}</strong>
        </p>
        <Meter.Root className={styles.meter} value={summary.totalEvents} min={0} max={eventCap}>
          <div className={styles.meterHeader}>
            <Meter.Label>Captured Events</Meter.Label>
            <Meter.Value>{() => `${summary.totalEvents} / ${eventCap}`}</Meter.Value>
          </div>
          <Meter.Track>
            <Meter.Indicator />
          </Meter.Track>
        </Meter.Root>
      </TuiWindow>
    </div>
  );
}
