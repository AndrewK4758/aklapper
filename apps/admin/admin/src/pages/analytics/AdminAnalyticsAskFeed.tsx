import type { AnalyticsAskTurnItem } from '@aklapper/core';
import { href, Link } from 'react-router';

import { formatAnalyticsLocation } from './analytics-filter-url';

import styles from './AdminAnalyticsPage.module.css';

export interface AdminAnalyticsAskFeedProps {
  readonly turns: readonly AnalyticsAskTurnItem[];
}

function formatModeLabel(mode: AnalyticsAskTurnItem['mode']): string {
  return mode === 'jd_match' ? 'JD Match' : 'Q&A';
}

export function AdminAnalyticsAskFeed({ turns }: AdminAnalyticsAskFeedProps) {
  return (
    <section className={styles.tableCard} data-testid='analytics-ask-feed'>
      <div className={styles.headerRow}>
        <h2 className={styles.sectionTitle}>Visitor Q&amp;A &amp; JD Match Feed</h2>
        <span className={styles.metricLabel}>
          {turns.length} turn{turns.length === 1 ? '' : 's'} shown (max 25)
        </span>
      </div>

      {turns.length === 0 ? (
        <p className={styles.emptyNote}>
          No Visitor Q&amp;A or JD Match turns recorded for the active filters.
        </p>
      ) : (
        <div className={styles.askList}>
          {turns.map(turn => {
            const location = formatAnalyticsLocation(turn.city, turn.region, turn.country);
            return (
              <article key={turn.attemptId} className={styles.askCard}>
                <div className={styles.visitorHeader}>
                  <div className={styles.visitorIdentity}>
                    <span className={styles.modeBadge}>{formatModeLabel(turn.mode)}</span>
                    <span className={styles.statusBadge}>{turn.status}</span>
                    <span className={styles.visitorOrg}>{location}</span>
                    {turn.asnOrg ? (
                      <span className={styles.visitorOrg}>· {turn.asnOrg}</span>
                    ) : null}
                    {turn.contactId && turn.contactName ? (
                      <Link
                        to={`${href('/inbox')}?selected=${encodeURIComponent(turn.contactId)}`}
                        prefetch='intent'
                        className={styles.contactBadge}
                      >
                        Contact: {turn.contactName}
                      </Link>
                    ) : null}
                  </div>
                  <time className={styles.metricLabel} dateTime={turn.createdAt}>
                    {turn.createdAt.replace('T', ' ').slice(0, 16)} UTC · {turn.tokensUsed} tok
                  </time>
                </div>
                <p className={styles.askExcerpt}>
                  {turn.promptExcerpt?.trim() || 'Redacted or unavailable prompt excerpt.'}
                </p>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
