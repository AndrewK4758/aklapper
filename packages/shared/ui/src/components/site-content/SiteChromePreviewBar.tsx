import type { StatusBadgeSpec } from '@aklapper/core';

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
  readonly maintenanceModeDefault?: boolean | undefined;
}

export function SiteChromePreviewBar({
  pageTitle,
  brandLabel,
  shortcutHint,
  statusBadge,
  footerText,
  footerLinkLabel,
  footerLinkUrl,
  maintenanceModeDefault,
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

      {footerText || footerLinkLabel || maintenanceModeDefault !== undefined ? (
        <div className={styles.chromeFooter}>
          <span>{footerText ?? ''}</span>
          {footerLinkLabel ? (
            <span className={styles.chromeLink} title={footerLinkUrl}>
              {footerLinkLabel}
              {footerLinkUrl ? ` (${footerLinkUrl})` : ''}
            </span>
          ) : null}
          {maintenanceModeDefault !== undefined ? (
            <span className={styles.chromeMeta}>
              Maintenance default: {maintenanceModeDefault ? 'ON' : 'OFF'}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
