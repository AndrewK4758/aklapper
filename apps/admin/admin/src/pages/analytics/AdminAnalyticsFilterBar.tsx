import type {
  AdminAnalyticsBotsMode,
  AdminAnalyticsFilter,
  AdminAnalyticsIdentifiedFilter,
  AdminAnalyticsWindow,
} from '@aklapper/core';
import { Link } from 'react-router';

import { buildAdminAnalyticsHref, hasActiveDrilldownFilters } from './analytics-filter-url';

import styles from './AdminAnalyticsPage.module.css';

export interface AdminAnalyticsFilterBarProps {
  readonly filter: AdminAnalyticsFilter;
}

const WINDOWS: readonly { readonly id: AdminAnalyticsWindow; readonly label: string }[] = [
  { id: '24h', label: '24h' },
  { id: '7d', label: '7d' },
  { id: '30d', label: '30d' },
  { id: 'all', label: 'All' },
];

const BOT_MODES: readonly { readonly id: AdminAnalyticsBotsMode; readonly label: string }[] = [
  { id: 'exclude', label: 'Humans Only' },
  { id: 'include', label: 'Include Bots' },
  { id: 'only', label: 'Bots Only' },
];

const IDENTIFIED_MODES: readonly {
  readonly id: AdminAnalyticsIdentifiedFilter;
  readonly label: string;
}[] = [
  { id: 'all', label: 'All Visitors' },
  { id: 'true', label: 'Identified Leads' },
];

interface ActiveChip {
  readonly key: 'source' | 'country' | 'path' | 'campaign';
  readonly label: string;
  readonly value: string;
}

export function AdminAnalyticsFilterBar({ filter }: AdminAnalyticsFilterBarProps) {
  const chips: ActiveChip[] = [];
  if (filter.source) chips.push({ key: 'source', label: 'Source', value: filter.source });
  if (filter.country) chips.push({ key: 'country', label: 'Country', value: filter.country });
  if (filter.path) chips.push({ key: 'path', label: 'Path', value: filter.path });
  if (filter.campaign) chips.push({ key: 'campaign', label: 'Campaign', value: filter.campaign });

  const showClear = hasActiveDrilldownFilters(filter);

  return (
    <div className={styles.filterSection} data-testid='analytics-filter-bar'>
      <div className={styles.filterControlsRow}>
        <nav className={styles.windowBar} aria-label='Analytics time window'>
          {WINDOWS.map(win => (
            <Link
              key={win.id}
              to={buildAdminAnalyticsHref(filter, { window: win.id })}
              prefetch='intent'
              className={styles.windowLink}
              data-active={filter.window === win.id ? 'true' : 'false'}
              aria-current={filter.window === win.id ? 'true' : undefined}
            >
              {win.label}
            </Link>
          ))}
        </nav>

        <nav className={styles.windowBar} aria-label='Analytics bot filter'>
          {BOT_MODES.map(mode => (
            <Link
              key={mode.id}
              to={buildAdminAnalyticsHref(filter, { bots: mode.id })}
              prefetch='intent'
              className={styles.windowLink}
              data-active={filter.bots === mode.id ? 'true' : 'false'}
              aria-current={filter.bots === mode.id ? 'true' : undefined}
            >
              {mode.label}
            </Link>
          ))}
        </nav>

        <nav className={styles.windowBar} aria-label='Analytics identity filter'>
          {IDENTIFIED_MODES.map(mode => (
            <Link
              key={mode.id}
              to={buildAdminAnalyticsHref(filter, { identified: mode.id })}
              prefetch='intent'
              className={styles.windowLink}
              data-active={filter.identified === mode.id ? 'true' : 'false'}
              aria-current={filter.identified === mode.id ? 'true' : undefined}
            >
              {mode.label}
            </Link>
          ))}
        </nav>
      </div>

      {chips.length > 0 || showClear ? (
        <div className={styles.chipRow} aria-label='Active analytics filters'>
          {chips.map(chip => (
            <Link
              key={chip.key}
              to={buildAdminAnalyticsHref(filter, { [chip.key]: undefined })}
              prefetch='intent'
              className={styles.filterChip}
              title={`Clear ${chip.label} filter`}
            >
              <span>
                {chip.label}: <strong>{chip.value}</strong>
              </span>
              <span aria-hidden='true'>×</span>
            </Link>
          ))}
          {showClear ? (
            <Link
              to={`/analytics?window=${filter.window}`}
              prefetch='intent'
              className={styles.clearFiltersLink}
            >
              Clear filters
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
