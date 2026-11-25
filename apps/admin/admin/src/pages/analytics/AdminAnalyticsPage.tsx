import type {
  AdminAnalyticsBreakdownsData,
  AdminAnalyticsLoaderData,
  AdminAnalyticsSummaryData,
  AdminAnalyticsWindow,
  CwvMetricName,
} from '@aklapper/core';
import { Meter, Separator, TuiWindow } from '@aklapper/ui';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { AdminAnalyticsBreakdowns } from './AdminAnalyticsBreakdowns';

import styles from './AdminAnalyticsPage.module.css';

export interface AdminAnalyticsPageProps {
  data: AdminAnalyticsSummaryData | AdminAnalyticsLoaderData;
  breakdownsSlot?: ReactNode;
}

const WINDOWS: readonly { id: AdminAnalyticsWindow; label: string }[] = [
  { id: '24h', label: '24h' },
  { id: '7d', label: '7d' },
  { id: '30d', label: '30d' },
  { id: 'all', label: 'All' },
];

function formatCwvValue(metric: CwvMetricName, value: number | null): string {
  if (value === null) return '—';
  if (metric === 'CLS') return value.toFixed(3);
  return `${Math.round(value)} ms`;
}

function hasBreakdownsData(
  value: AdminAnalyticsSummaryData | AdminAnalyticsLoaderData,
): value is AdminAnalyticsLoaderData {
  return 'topPaths' in value && 'topReferrers' in value && 'geoBreakdown' in value;
}

export function AdminAnalyticsPage({ data, breakdownsSlot }: AdminAnalyticsPageProps) {
  const { content, window: activeWindow, totalSessions, totalEvents, cwv, aiMetrics } = data;
  const eventCap = Math.max(totalEvents, 100);
  const fallbackBreakdowns: AdminAnalyticsBreakdownsData | null = hasBreakdownsData(data)
    ? {
        topPaths: data.topPaths,
        topReferrers: data.topReferrers,
        geoBreakdown: data.geoBreakdown,
        agensiConversions: data.agensiConversions,
      }
    : null;

  return (
    <TuiWindow title={content.windowTitle}>
      <div className={styles.panel}>
        <div className={styles.headerRow}>
          <p>{content.description}</p>
          <nav className={styles.windowBar} aria-label='Analytics time window'>
            {WINDOWS.map(win => (
              <Link
                key={win.id}
                to={`/analytics?window=${win.id}`}
                prefetch='intent'
                className={styles.windowLink}
                data-active={activeWindow === win.id ? 'true' : 'false'}
                aria-current={activeWindow === win.id ? 'true' : undefined}
              >
                {win.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className={styles.summaryGrid}>
          <article className={styles.metricCard}>
            <span className={styles.metricLabel}>Total Sessions ({activeWindow})</span>
            <strong className={styles.metricValue}>{totalSessions}</strong>
          </article>
          <article className={styles.metricCard}>
            <span className={styles.metricLabel}>Total Events ({activeWindow})</span>
            <strong className={styles.metricValue}>{totalEvents}</strong>
          </article>
          <article className={styles.metricCard}>
            <span className={styles.metricLabel}>CADENCE Runs</span>
            <strong className={styles.metricValue}>{aiMetrics.totalRuns}</strong>
          </article>
          <article className={styles.metricCard}>
            <span className={styles.metricLabel}>AI Tokens (In / Out)</span>
            <strong className={styles.metricValue}>
              {aiMetrics.totalTokensIn} / {aiMetrics.totalTokensOut}
            </strong>
          </article>
        </div>

        <Meter.Root value={totalEvents} min={0} max={eventCap} className={styles.meter}>
          <div className={styles.meterHeader}>
            <Meter.Label>Ingested Event Volume</Meter.Label>
            <Meter.Value>{() => `${totalEvents} / ${eventCap}`}</Meter.Value>
          </div>
          <Meter.Track>
            <Meter.Indicator />
          </Meter.Track>
        </Meter.Root>

        <section aria-label='Core Web Vitals percentiles'>
          <h2 className={styles.sectionTitle}>Core Web Vitals Percentiles</h2>
          <div className={styles.cwvGrid}>
            {cwv.map(row => (
              <article key={row.metric} className={styles.cwvCard}>
                <div className={styles.headerRow}>
                  <strong>{row.metric}</strong>
                  <span className={styles.metricLabel}>{row.sampleCount} samples</span>
                </div>
                <div className={styles.cwvRow}>
                  <span>p50</span>
                  <strong>{formatCwvValue(row.metric, row.p50)}</strong>
                </div>
                <div className={styles.cwvRow}>
                  <span>p75</span>
                  <strong>{formatCwvValue(row.metric, row.p75)}</strong>
                </div>
                <div className={styles.cwvRow}>
                  <span>p95</span>
                  <strong>{formatCwvValue(row.metric, row.p95)}</strong>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.tableCard}>
          <h2 className={styles.sectionTitle}>AI / CADENCE Gate &amp; Abstention Metrics</h2>
          <table className={styles.dataTable}>
            <tbody>
              <tr>
                <td>Approved Gates</td>
                <td className={styles.numericCell}>{aiMetrics.approvedGates}</td>
              </tr>
              <tr>
                <td>Rejected Gates</td>
                <td className={styles.numericCell}>{aiMetrics.rejectedGates}</td>
              </tr>
              <tr>
                <td>Pending Gates</td>
                <td className={styles.numericCell}>{aiMetrics.pendingGates}</td>
              </tr>
              <tr>
                <td>AI Abstention Events</td>
                <td className={styles.numericCell}>{aiMetrics.abstentionEvents}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <Separator.Root />

        {breakdownsSlot ??
          (fallbackBreakdowns ? <AdminAnalyticsBreakdowns data={fallbackBreakdowns} /> : null)}
      </div>
    </TuiWindow>
  );
}
