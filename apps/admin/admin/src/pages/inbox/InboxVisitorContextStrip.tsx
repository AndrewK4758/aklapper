import type { InboxVisitorContext } from '@aklapper/core';

import styles from './AdminInboxPage.module.css';

export interface InboxVisitorContextStripProps {
  readonly context: InboxVisitorContext | null | undefined;
}

function joinDefined(values: readonly (string | null | undefined)[], separator: string): string {
  return values
    .map(value => value?.trim())
    .filter((value): value is string => Boolean(value))
    .join(separator);
}

function formatDevice(context: InboxVisitorContext): string {
  const device = context.deviceType
    ? `${context.deviceType.slice(0, 1).toUpperCase()}${context.deviceType.slice(1)}`
    : null;
  return joinDefined([device, context.osName, context.browserName], ' / ') || 'Unknown client';
}

function formatSource(context: InboxVisitorContext): string {
  const parts: string[] = [];
  if (context.referrerHost) {
    parts.push(
      context.referrerCategory
        ? `${context.referrerHost} (${context.referrerCategory})`
        : context.referrerHost,
    );
  } else {
    parts.push('Direct');
  }
  if (context.refParam) parts.push(`ref=${context.refParam}`);
  if (context.utmSource) parts.push(`utm=${context.utmSource}`);
  if (context.utmCampaign) parts.push(`campaign=${context.utmCampaign}`);
  return parts.join(' · ');
}

export function InboxVisitorContextStrip({ context }: InboxVisitorContextStripProps) {
  if (!context) {
    return (
      <section
        className={styles.visitorContextStrip}
        aria-label='Visitor context'
        data-testid='inbox-visitor-context'
      >
        <span className={styles.metaLabel}>Visitor Context</span>
        <p className={styles.visitorContextEmpty}>
          No linked visitor session recorded for this submission.
        </p>
      </section>
    );
  }

  const location = joinDefined([context.city, context.region, context.country], ', ') || 'Unknown';
  const network = context.asnOrg ?? '—';
  const source = formatSource(context);
  const device = formatDevice(context);

  return (
    <section
      className={styles.visitorContextStrip}
      aria-label='Visitor context'
      data-testid='inbox-visitor-context'
    >
      <span className={styles.metaLabel}>Visitor Context</span>
      <div className={styles.visitorContextGrid}>
        <div>
          <span className={styles.metaLabel}>Location</span>
          <span>{location}</span>
        </div>
        <div>
          <span className={styles.metaLabel}>Network / Org</span>
          <span>{network}</span>
        </div>
        <div>
          <span className={styles.metaLabel}>Source &amp; Campaign</span>
          <span>{source}</span>
        </div>
        <div>
          <span className={styles.metaLabel}>Device / Browser</span>
          <span>{device}</span>
        </div>
        <div>
          <span className={styles.metaLabel}>Landing &amp; Engagement</span>
          <span>
            {context.landingPath ?? '/'} · {context.paneOpenCount} pane open
            {context.paneOpenCount === 1 ? '' : 's'}
          </span>
        </div>
        <div>
          <span className={styles.metaLabel}>AI Q&amp;A / JD Match</span>
          <span>
            {context.askTurnCount} turn{context.askTurnCount === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      {context.viewedPaths.length > 0 ? (
        <div className={styles.visitorContextRow}>
          <span className={styles.metaLabel}>Viewed Pages</span>
          <div className={styles.visitorPathList}>
            {context.viewedPaths.map(path => (
              <code key={path} className={styles.visitorPathPill}>
                {path}
              </code>
            ))}
          </div>
        </div>
      ) : null}

      {context.latestAskPromptExcerpt ? (
        <div className={styles.visitorContextRow}>
          <span className={styles.metaLabel}>Latest AI Prompt Excerpt</span>
          <p className={styles.visitorContextExcerpt}>{context.latestAskPromptExcerpt}</p>
        </div>
      ) : null}
    </section>
  );
}
