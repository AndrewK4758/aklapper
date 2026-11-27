import type { AdminAnalyticsFilter, AdminAnalyticsWindow } from '@aklapper/core';
import { href } from 'react-router';

export const DEFAULT_ADMIN_ANALYTICS_FILTER: AdminAnalyticsFilter = {
  window: '7d',
  bots: 'exclude',
  identified: 'all',
};

export function resolveActiveAnalyticsFilter(
  window: AdminAnalyticsWindow,
  filters?: AdminAnalyticsFilter,
): AdminAnalyticsFilter {
  if (filters) {
    return filters;
  }
  return {
    window,
    bots: 'exclude',
    identified: 'all',
  };
}

export function buildAdminAnalyticsHref(
  current: AdminAnalyticsFilter,
  patch: Partial<Record<keyof AdminAnalyticsFilter, string | undefined>>,
): string {
  const next: AdminAnalyticsFilter = {
    ...current,
    ...(patch as Partial<AdminAnalyticsFilter>),
  };

  const params = new URLSearchParams();
  params.set('window', next.window);
  if (next.bots !== 'exclude') params.set('bots', next.bots);
  if (next.identified !== 'all') params.set('identified', next.identified);
  if (next.source) params.set('source', next.source);
  if (next.country) params.set('country', next.country);
  if (next.path) params.set('path', next.path);
  if (next.campaign) params.set('campaign', next.campaign);

  return `${href('/analytics')}?${params.toString()}`;
}

export function hasActiveDrilldownFilters(filter: AdminAnalyticsFilter): boolean {
  return (
    filter.bots !== 'exclude' ||
    filter.identified !== 'all' ||
    Boolean(filter.source) ||
    Boolean(filter.country) ||
    Boolean(filter.path) ||
    Boolean(filter.campaign)
  );
}

export function formatAnalyticsLocation(
  city: string | null | undefined,
  region: string | null | undefined,
  country: string | null | undefined,
): string {
  const parts = [city, region, country]
    .map(part => part?.trim())
    .filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(', ') : 'Unknown location';
}

export function formatDeviceLabel(
  deviceType: string | null | undefined,
  osName: string | null | undefined,
  browserName: string | null | undefined,
): string {
  const normalizedDevice = deviceType
    ? `${deviceType.slice(0, 1).toUpperCase()}${deviceType.slice(1)}`
    : null;
  const parts = [normalizedDevice, osName, browserName]
    .map(part => part?.trim())
    .filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(' / ') : 'Unknown client';
}
