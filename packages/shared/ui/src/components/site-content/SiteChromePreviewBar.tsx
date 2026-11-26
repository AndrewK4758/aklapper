import type { StatusBadgeSpec } from '@aklapper/core';

import { Tooltip } from '../../elements/base';
import { OscStatusBadge } from '../../elements/OscStatusBadge';

import styles from './SiteContentPreview.module.css';

export interface SiteChromePreviewBarProps {
  readonly pageTitle: string;
  readonly brandLabel: string;
  readonly shortcutHint?: string | undefined;
  readonly statusBadge: StatusBadgeSpec;
  readonly footerText?: string | undefined;
  readonly footerLinkLabel?: string | undefined;
  readonly footerLinkUrl?: string | undefined;
}

export function SiteChromePreviewBar({
  pageTitle,
  brandLabel,
  shortcutHint,
  statusBadge,
  footerText,
  footerLinkLabel,
  footerLinkUrl,
}: SiteChromePreviewBarProps) {
  return (
    <div className={styles.chromeShell}>
      <div className={styles.chromeHeader}>
        <div className={styles.chromeBrandGroup}>
          <span className={styles.chromeBrand}>{brandLabel}</span>
          <span className={styles.chromeMeta}>
            {pageTitle}
            {shortcutHint ? ` · ${shortcutHint}` : ''}
          </span>
        </div>
        <OscStatusBadge
          source={statusBadge.source}
          state={statusBadge.state}
          label={statusBadge.label}
        />
      </div>

      {footerText || footerLinkLabel ? (
        <div className={styles.chromeFooter}>
          <span>{footerText ?? ''}</span>
          {footerLinkLabel ? (
            footerLinkUrl ? (
              <Tooltip.Root>
                <Tooltip.Trigger
                  render={
                    <span className={styles.chromeLink}>
                      {footerLinkLabel}
                      {` (${footerLinkUrl})`}
                    </span>
                  }
                />
                <Tooltip.Portal>
                  <Tooltip.Positioner sideOffset={6}>
                    <Tooltip.Popup>{footerLinkUrl}</Tooltip.Popup>
                  </Tooltip.Positioner>
                </Tooltip.Portal>
              </Tooltip.Root>
            ) : (
              <span className={styles.chromeLink}>{footerLinkLabel}</span>
            )
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
