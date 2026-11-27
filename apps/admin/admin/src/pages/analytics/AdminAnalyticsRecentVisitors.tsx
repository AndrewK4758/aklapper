import type { AnalyticsRecentVisitor } from '@aklapper/core';
import { Link } from 'react-router';

import { formatAnalyticsLocation, formatDeviceLabel } from './analytics-filter-url';

import styles from './AdminAnalyticsPage.module.css';

export interface AdminAnalyticsRecentVisitorsProps {
  readonly visitors: readonly AnalyticsRecentVisitor[];
}

function formatShortTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
}

function buildAttributionSummary(visitor: AnalyticsRecentVisitor): string {
  const parts: string[] = [];
  if (visitor.referrerHost) {
    parts.push(
      visitor.referrerCategory
        ? `${visitor.referrerHost} (${visitor.referrerCategory})`
        : visitor.referrerHost,
    );
  } else {
    parts.push('Direct');
  }
  if (visitor.refParam) parts.push(`ref=${visitor.refParam}`);
  if (visitor.utmSource) parts.push(`utm_source=${visitor.utmSource}`);
  if (visitor.utmCampaign) parts.push(`campaign=${visitor.utmCampaign}`);
  return parts.join(' · ');
}

export function AdminAnalyticsRecentVisitors({ visitors }: AdminAnalyticsRecentVisitorsProps) {
  return (
    <section className={styles.tableCard} data-testid='analytics-recent-visitors'>
      <div className={styles.headerRow}>
        <h2 className={styles.sectionTitle}>Recent Visitors</h2>
        <span className={styles.metricLabel}>
          {visitors.length} session{visitors.length === 1 ? '' : 's'} shown (max 25)
        </span>
      </div>

      {visitors.length === 0 ? (
        <p className={styles.emptyNote}>
          No visitor sessions match the active filters in this window.
        </p>
      ) : (
        <div className={styles.visitorList}>
          {visitors.map(visitor => {
            const location = formatAnalyticsLocation(visitor.city, visitor.region, visitor.country);
            const device = formatDeviceLabel(
              visitor.deviceType,
              visitor.osName,
              visitor.browserName,
            );
            const attribution = buildAttributionSummary(visitor);

            return (
              <article key={visitor.sessionId} className={styles.visitorCard}>
                <div className={styles.visitorHeader}>
                  <div className={styles.visitorIdentity}>
                    <strong>{location}</strong>
                    {visitor.asnOrg ? (
                      <span className={styles.visitorOrg}>{visitor.asnOrg}</span>
                    ) : null}
                    {visitor.isBot ? <span className={styles.botBadge}>Bot</span> : null}
                    {visitor.contactId && visitor.contactName ? (
                      <Link
                        to={`/inbox?selected=${encodeURIComponent(visitor.contactId)}`}
                        prefetch='intent'
                        className={styles.contactBadge}
                        data-testid={`visitor-contact-link-${visitor.contactId}`}
                      >
                        Contact: {visitor.contactName}
                      </Link>
                    ) : null}
                  </div>
                  <time className={styles.metricLabel} dateTime={visitor.startedAt}>
                    {formatShortTimestamp(visitor.startedAt)}
                  </time>
                </div>

                <div className={styles.visitorMetaRow}>
                  <span>Source: {attribution}</span>
                  <span>Landing: {visitor.landingPath ?? '/'}</span>
                  <span>Client: {device}</span>
                  <span>
                    {visitor.pageViewCount} views · {visitor.eventCount} events
                    {visitor.askTurnCount > 0 ? ` · ${visitor.askTurnCount} AI turns` : ''}
                  </span>
                </div>

                <details className={styles.trailDetails}>
                  <summary className={styles.trailSummary}>
                    Event trail ({visitor.trail.length} event
                    {visitor.trail.length === 1 ? '' : 's'})
                  </summary>
                  {visitor.trail.length === 0 ? (
                    <p className={styles.emptyNote}>No events recorded for this session.</p>
                  ) : (
                    <ol className={styles.trailList}>
                      {visitor.trail.map((event, idx) => (
                        <li
                          key={`${visitor.sessionId}:${event.createdAt}:${idx}`}
                          className={styles.trailItem}
                        >
                          <span className={styles.trailTime}>
                            {event.createdAt.slice(11, 19)} UTC
                          </span>
                          <span className={styles.trailName}>{event.name}</span>
                          <span className={styles.trailPath}>{event.path}</span>
                          {event.detail ? (
                            <span className={styles.trailDetail}>{event.detail}</span>
                          ) : null}
                        </li>
                      ))}
                    </ol>
                  )}
                </details>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
