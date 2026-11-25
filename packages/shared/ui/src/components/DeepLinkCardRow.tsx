import { isPortalNavigableRoutePath, type AskSuggestedLink } from '@aklapper/core';

import { PaneLink } from './PaneLink';

import styles from './DeepLinkCardRow.module.css';

export interface DeepLinkCardRowProps {
  readonly heading: string;
  readonly links: readonly AskSuggestedLink[];
  readonly testId?: string;
}

export function DeepLinkCardRow({ heading, links, testId }: DeepLinkCardRowProps) {
  const validLinks: AskSuggestedLink[] = [];
  for (const link of links) {
    if (isPortalNavigableRoutePath(link.route)) {
      validLinks.push(link);
    } else if (typeof console !== 'undefined') {
      console.warn(
        JSON.stringify({
          event: 'ai_ask.deeplink.disallowed_route_rejected',
          seam_type: 'UNSOUND_CONDITION',
          severity: 'HIGH',
          route: String(link.route).slice(0, 64),
        }),
      );
    }
  }

  if (validLinks.length === 0) {
    return null;
  }

  return (
    <nav className={styles.nav} aria-label={heading} data-testid={testId}>
      <h4 className={styles.heading}>{heading}</h4>
      <div className={styles.grid}>
        {validLinks.map(link => (
          <PaneLink key={`${link.route}-${link.label}`} to={link.route} className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.cardLabel}>{link.label}</span>
              <span className={styles.cardRoute}>{link.route}</span>
            </div>
            <p className={styles.cardReason}>{link.reason}</p>
          </PaneLink>
        ))}
      </div>
    </nav>
  );
}
