import {
  type AdminAnalyticsBreakdownsData,
  type AdminAnalyticsLoaderData,
  type AdminAnalyticsSummaryData,
  type AdminHomeLoaderData,
  type AdminRootLoaderData,
  MenuItemSchema,
  type PortalAboutLoaderData,
  type PortalAgensiLoaderData,
  type PortalAskLoaderData,
  type PortalCadenceLoaderData,
  type PortalContactLoaderData,
  type PortalHomeLoaderData,
  type PortalRootLoaderData,
} from '@aklapper/core';
import {
  buildSeedTerminalProfile,
  getPrerenderPortalAboutData,
  getPrerenderPortalAgensiData as getCorePrerenderPortalAgensiData,
  getPrerenderPortalAskData,
  getPrerenderPortalCadenceData,
  getPrerenderPortalContactData,
  getPrerenderPortalHomeData,
  getPrerenderPortalRootData,
  TERMINAL_PROFILE_SLUGS,
} from '@aklapper/core/prerender';
import { resolveAgensiCreatorHandle } from '@aklapper/node-runtime/agensi';

import {
  loadAdminAnalyticsBreakdowns,
  loadAdminAnalyticsData,
  loadAdminAnalyticsSummary,
} from './admin-analytics-queries.ts';
import {
  type AdminAnalyticsFilterInput,
  normalizeAdminAnalyticsFilter,
} from './admin-analytics-visitors.ts';
import type { AgensiSyncOptions } from './agensi-sync.ts';
import { type AppDatabase, getSharedDb, isReactRouterPrerender } from './client.ts';
import {
  loadAdminHomeData,
  loadAdminRootData,
  loadPortalAboutData,
  loadPortalAgensiData,
  loadPortalAskData,
  loadPortalCadenceData,
  loadPortalContactData,
  loadPortalHomeData,
  loadPortalRootData,
} from './queries.ts';
import {
  ADMIN_ANALYTICS_SEED,
  ADMIN_CHROME_SEED,
  ADMIN_HOME_SEED,
  DEFAULT_MENU_ITEMS,
} from './seed.ts';

export {
  getPrerenderPortalAboutData,
  getPrerenderPortalAskData,
  getPrerenderPortalCadenceData,
  getPrerenderPortalContactData,
  getPrerenderPortalHomeData,
  getPrerenderPortalRootData,
};

export function getPrerenderPortalAgensiData(): PortalAgensiLoaderData {
  return getCorePrerenderPortalAgensiData(resolveAgensiCreatorHandle());
}

export function getPrerenderAdminRootData(): AdminRootLoaderData {
  return {
    chrome: ADMIN_CHROME_SEED,
    terminal: buildSeedTerminalProfile(TERMINAL_PROFILE_SLUGS.adminOps),
  };
}

export function getPrerenderAdminHomeData(): AdminHomeLoaderData {
  return {
    content: ADMIN_HOME_SEED,
    menuItems: DEFAULT_MENU_ITEMS.toSorted((a, b) => a.sortOrder - b.sortOrder).map(item =>
      MenuItemSchema.parse(item),
    ),
  };
}

export function getPrerenderAdminAnalyticsSummaryData(
  filterInput: AdminAnalyticsFilterInput = '7d',
): AdminAnalyticsSummaryData {
  const filters = normalizeAdminAnalyticsFilter(filterInput);
  return {
    content: ADMIN_ANALYTICS_SEED,
    window: filters.window,
    filters,
    totalSessions: 0,
    totalEvents: 0,
    uniqueVisitors: 0,
    returningVisitors: 0,
    totalPageViews: 0,
    profileViews: 0,
    highIntentActions: 0,
    identifiedLeads: 0,
    botSessionsExcluded: 0,
    dailyTrend: [],
    summary: {
      totalSessions: 0,
      totalEvents: 0,
    },
    cwv: [
      { metric: 'LCP', sampleCount: 0, p50: null, p75: null, p95: null },
      { metric: 'INP', sampleCount: 0, p50: null, p75: null, p95: null },
      { metric: 'CLS', sampleCount: 0, p50: null, p75: null, p95: null },
      { metric: 'TTFB', sampleCount: 0, p50: null, p75: null, p95: null },
    ],
    aiMetrics: {
      totalRuns: 0,
      totalTokensIn: 0,
      totalTokensOut: 0,
      approvedGates: 0,
      rejectedGates: 0,
      pendingGates: 0,
      abstentionEvents: 0,
    },
  };
}

export function getPrerenderAdminAnalyticsBreakdownsData(): AdminAnalyticsBreakdownsData {
  return {
    topPaths: [],
    topReferrers: [],
    geoBreakdown: [],
    agensiConversions: [],
    orgBreakdown: [],
    campaignBreakdown: [],
    deviceBreakdown: [],
    osBreakdown: [],
    browserBreakdown: [],
    conversionFunnel: [],
    recentVisitors: [],
    askTurnsFeed: [],
  };
}

export function getPrerenderAdminAnalyticsData(
  filterInput: AdminAnalyticsFilterInput = '7d',
): AdminAnalyticsLoaderData {
  return {
    ...getPrerenderAdminAnalyticsSummaryData(filterInput),
    ...getPrerenderAdminAnalyticsBreakdownsData(),
  };
}

export async function withPrerenderFallback<T>(
  loadFromDb: (db: AppDatabase) => Promise<T>,
  getFallback: () => T,
): Promise<T> {
  if (!isReactRouterPrerender()) {
    return loadFromDb(getSharedDb());
  }

  if (!process.env['DATABASE_URL']) {
    return getFallback();
  }

  try {
    return await loadFromDb(getSharedDb());
  } catch {
    return getFallback();
  }
}

export function loadPortalRootDataWithPrerender(): Promise<PortalRootLoaderData> {
  return withPrerenderFallback(loadPortalRootData, getPrerenderPortalRootData);
}

export function loadPortalHomeDataWithPrerender(): Promise<PortalHomeLoaderData> {
  return withPrerenderFallback(loadPortalHomeData, getPrerenderPortalHomeData);
}

export function loadPortalAboutDataWithPrerender(): Promise<PortalAboutLoaderData> {
  return withPrerenderFallback(loadPortalAboutData, getPrerenderPortalAboutData);
}

export function loadPortalAgensiDataWithPrerender(
  options: AgensiSyncOptions = {},
): Promise<PortalAgensiLoaderData> {
  return withPrerenderFallback(
    db =>
      loadPortalAgensiData(db, {
        ...options,
        skipLiveSync: options.skipLiveSync ?? isReactRouterPrerender(),
      }),
    getPrerenderPortalAgensiData,
  );
}

export function loadPortalAskDataWithPrerender(sessionId?: string): Promise<PortalAskLoaderData> {
  return withPrerenderFallback(db => loadPortalAskData(db, sessionId), getPrerenderPortalAskData);
}

export function loadPortalCadenceDataWithPrerender(
  sessionId?: string,
): Promise<PortalCadenceLoaderData> {
  return withPrerenderFallback(
    db => loadPortalCadenceData(db, sessionId),
    getPrerenderPortalCadenceData,
  );
}

export function loadPortalContactDataWithPrerender(): Promise<PortalContactLoaderData> {
  return withPrerenderFallback(loadPortalContactData, getPrerenderPortalContactData);
}

export function loadAdminRootDataWithPrerender(): Promise<AdminRootLoaderData> {
  return withPrerenderFallback(loadAdminRootData, getPrerenderAdminRootData);
}

export function loadAdminHomeDataWithPrerender(): Promise<AdminHomeLoaderData> {
  return withPrerenderFallback(loadAdminHomeData, getPrerenderAdminHomeData);
}

export function loadAdminAnalyticsSummaryWithPrerender(
  filterInput: AdminAnalyticsFilterInput = '7d',
): Promise<AdminAnalyticsSummaryData> {
  return withPrerenderFallback(
    db => loadAdminAnalyticsSummary(db, filterInput),
    () => getPrerenderAdminAnalyticsSummaryData(filterInput),
  );
}

export function loadAdminAnalyticsBreakdownsWithPrerender(
  filterInput: AdminAnalyticsFilterInput = '7d',
): Promise<AdminAnalyticsBreakdownsData> {
  return withPrerenderFallback(
    db => loadAdminAnalyticsBreakdowns(db, filterInput),
    getPrerenderAdminAnalyticsBreakdownsData,
  );
}

export function loadAdminAnalyticsDataWithPrerender(
  filterInput: AdminAnalyticsFilterInput = '7d',
): Promise<AdminAnalyticsLoaderData> {
  return withPrerenderFallback(
    db => loadAdminAnalyticsData(db, filterInput),
    () => getPrerenderAdminAnalyticsData(filterInput),
  );
}
