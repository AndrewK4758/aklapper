import type { AdminAnalyticsContent, AdminAnalyticsSummary } from '@aklapper/core';
import { Meter, Separator, TuiWindow } from '@aklapper/ui';

import styles from './AdminAnalyticsPage.module.css';

export interface AdminAnalyticsPageProps {
  content: AdminAnalyticsContent;
  summary: AdminAnalyticsSummary;
}

export function AdminAnalyticsPage({ content, summary }: AdminAnalyticsPageProps) {
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
