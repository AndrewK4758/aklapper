import type {
  AdminAnalyticsBreakdownsData,
  AdminAnalyticsLoaderData,
  AdminAnalyticsSummaryData,
  CwvMetricName,
} from '@aklapper/core';
import { Meter, Separator, TuiWindow } from '@aklapper/ui';
import type { ReactNode } from 'react';

import { AdminAnalyticsBreakdowns } from './AdminAnalyticsBreakdowns';
import { AdminAnalyticsFilterBar } from './AdminAnalyticsFilterBar';
import { resolveActiveAnalyticsFilter } from './analytics-filter-url';

import styles from './AdminAnalyticsPage.module.css';

export interface AdminAnalyticsPageProps {
  data: AdminAnalyticsSummaryData | AdminAnalyticsLoaderData;
  breakdownsSlot?: ReactNode;
}

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
  const activeFilter = resolveActiveAnalyticsFilter(activeWindow, data.filters);
  const eventCap = Math.max(totalEvents, 100);
  const uniqueVisitors = data.uniqueVisitors ?? totalSessions;
  const returningVisitors = data.returningVisitors ?? 0;
  const totalPageViews = data.totalPageViews ?? 0;
  const profileViews = data.profileViews ?? 0;
  const highIntentActions = data.highIntentActions ?? 0;
  const identifiedLeads = data.identifiedLeads ?? 0;
  const botSessionsExcluded = data.botSessionsExcluded ?? 0;
  const dailyTrend = data.dailyTrend ?? [];
  const maxTrendViews = Math.max(
    1,
    ...dailyTrend.map(point => Math.max(point.pageViews, point.sessions)),
  );

  const fallbackBreakdowns: AdminAnalyticsBreakdownsData | null = hasBreakdownsData(data)
    ? {
        topPaths: data.topPaths,
        topReferrers: data.topReferrers,
        geoBreakdown: data.geoBreakdown,
        agensiConversions: data.agensiConversions,
        orgBreakdown: data.orgBreakdown,
        campaignBreakdown: data.campaignBreakdown,
        deviceBreakdown: data.deviceBreakdown,
        osBreakdown: data.osBreakdown,
        browserBreakdown: data.browserBreakdown,
        conversionFunnel: data.conversionFunnel,
        recentVisitors: data.recentVisitors,
        askTurnsFeed: data.askTurnsFeed,
      }
    : null;

  return (
    <TuiWindow title={content.windowTitle}>
      <div className={styles.panel}>
        <div className={styles.headerStack}>
          <p className={styles.description}>{content.description}</p>
          <AdminAnalyticsFilterBar filter={activeFilter} />
        </div>

        <section aria-label='Visitor KPIs'>
          <div className={styles.summaryGrid}>
            <article className={styles.metricCard}>
              <span className={styles.metricLabel}>Unique Visitors</span>
              <strong className={styles.metricValue}>{uniqueVisitors}</strong>
            </article>
            <article className={styles.metricCard}>
              <span className={styles.metricLabel}>Returning Visitors</span>
              <strong className={styles.metricValue}>{returningVisitors}</strong>
            </article>
            <article className={styles.metricCard}>
              <span className={styles.metricLabel}>Total Sessions ({activeWindow})</span>
              <strong className={styles.metricValue}>{totalSessions}</strong>
            </article>
            <article className={styles.metricCard}>
              <span className={styles.metricLabel}>Page Views</span>
              <strong className={styles.metricValue}>{totalPageViews}</strong>
            </article>
            <article className={styles.metricCard}>
              <span className={styles.metricLabel}>Profile Views</span>
              <strong className={styles.metricValue}>{profileViews}</strong>
            </article>
            <article className={styles.metricCard}>
              <span className={styles.metricLabel}>High-Intent Actions</span>
              <strong className={styles.metricValue}>{highIntentActions}</strong>
            </article>
            <article className={styles.metricCard}>
              <span className={styles.metricLabel}>Identified Leads</span>
              <strong className={styles.metricValue}>{identifiedLeads}</strong>
            </article>
            <article className={styles.metricCard}>
              <span className={styles.metricLabel}>Filtered Bots</span>
              <strong className={styles.metricValue}>{botSessionsExcluded}</strong>
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
        </section>

        <Meter.Root value={totalEvents} min={0} max={eventCap} className={styles.meter}>
          <div className={styles.meterHeader}>
            <Meter.Label>Ingested Event Volume</Meter.Label>
            <Meter.Value>{() => `${totalEvents} / ${eventCap}`}</Meter.Value>
          </div>
          <Meter.Track>
            <Meter.Indicator />
          </Meter.Track>
        </Meter.Root>

        {dailyTrend.length > 0 ? (
          <section className={styles.tableCard} aria-label='Daily traffic trend'>
            <h2 className={styles.sectionTitle}>Daily Traffic Trend</h2>
            <div className={styles.trendList}>
              {dailyTrend.map(point => {
                const widthPct = Math.max(
                  4,
                  Math.round((Math.max(point.pageViews, point.sessions) / maxTrendViews) * 100),
                );
                return (
                  <div key={point.date} className={styles.trendRow}>
                    <span className={styles.trendDate}>{point.date}</span>
                    <div className={styles.trendBarTrack} aria-hidden='true'>
                      <div className={styles.trendBarFill} style={{ width: `${widthPct}%` }} />
                    </div>
                    <span className={styles.trendStats}>
                      {point.uniqueVisitors} uniq · {point.sessions} sess · {point.pageViews} views
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

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
          (fallbackBreakdowns ? (
            <AdminAnalyticsBreakdowns data={fallbackBreakdowns} filter={activeFilter} />
          ) : null)}
      </div>
    </TuiWindow>
  );
}
