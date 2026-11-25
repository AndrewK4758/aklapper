import {
  type AdminAnalyticsBreakdownsData,
  type AdminAnalyticsLoaderData,
  type AdminAnalyticsSummaryData,
  type AdminAnalyticsWindow,
  type AdminHomeLoaderData,
  type AdminRootLoaderData,
  AgensiSkillSchema,
  CadencePresetSchema,
  MenuItemSchema,
  type PortalAgensiLoaderData,
  type PortalAskLoaderData,
  type PortalCadenceLoaderData,
  type PortalContactLoaderData,
  type PortalHomeLoaderData,
  type PortalMaintenanceLoaderData,
  type PortalRootLoaderData,
  type QuotaStatus,
  RoadmapMilestoneSchema,
} from '@aklapper/core';
import { resolveAgensiCreatorHandle } from '@aklapper/node-runtime/agensi';

import {
  loadAdminAnalyticsBreakdowns,
  loadAdminAnalyticsData,
  loadAdminAnalyticsSummary,
} from './admin-analytics-queries.ts';
import type { AgensiSyncOptions } from './agensi-sync.ts';
import { type AppDatabase, getSharedDb, isReactRouterPrerender } from './client.ts';
import {
  loadAdminHomeData,
  loadAdminRootData,
  loadPortalAgensiData,
  loadPortalAskData,
  loadPortalCadenceData,
  loadPortalContactData,
  loadPortalHomeData,
  loadPortalMaintenanceData,
  loadPortalRootData,
  TERMINAL_PROFILE_SLUGS,
} from './queries.ts';
import { getPrerenderGoldenSandboxRuns } from './seed-golden-runs.ts';
import {
  ADMIN_ANALYTICS_SEED,
  ADMIN_CHROME_SEED,
  ADMIN_HOME_SEED,
  AGENSI_SKILL_SEEDS,
  buildSeedTerminalProfile,
  CADENCE_PRESET_SEEDS,
  DEFAULT_MENU_ITEMS,
  PORTAL_AGENSI_SEED,
  PORTAL_ASK_SEED,
  PORTAL_CADENCE_SEED,
  PORTAL_CHROME_SEED,
  PORTAL_CONTACT_SEED,
  PORTAL_HOME_SEED,
  PORTAL_MAINTENANCE_SEED,
  ROADMAP_MILESTONE_SEEDS,
} from './seed.ts';

const DEFAULT_GUEST_QUOTA: QuotaStatus = {
  role: 'guest',
  turnsUsed: 0,
  maxTurns: 10,
  tokensUsed: 0,
  maxTokens: 40_000,
};

export function getPrerenderPortalMaintenanceData(): PortalMaintenanceLoaderData {
  return {
    content: PORTAL_MAINTENANCE_SEED,
    terminal: buildSeedTerminalProfile(TERMINAL_PROFILE_SLUGS.portalMaintenance),
    milestones: ROADMAP_MILESTONE_SEEDS.filter(m => m.enabled)
      .toSorted((a, b) => a.sortOrder - b.sortOrder)
      .map(m => RoadmapMilestoneSchema.parse(m)),
  };
}

export function getPrerenderPortalRootData(
  maintenanceModeOverride?: boolean,
): PortalRootLoaderData {
  const maintenanceMode = maintenanceModeOverride ?? PORTAL_CHROME_SEED.maintenanceModeDefault;
  if (maintenanceMode) {
    return {
      maintenanceMode,
      chrome: PORTAL_CHROME_SEED,
      maintenance: getPrerenderPortalMaintenanceData(),
    };
  }

  const { content: homeContent, terminal, contactForm } = getPrerenderPortalHomeData();
  return {
    maintenanceMode,
    chrome: PORTAL_CHROME_SEED,
    maintenance: null,
    terminal,
    homeContent,
    contactForm,
  };
}

export function getPrerenderPortalHomeData(): PortalHomeLoaderData {
  return {
    content: PORTAL_HOME_SEED,
    terminal: buildSeedTerminalProfile(TERMINAL_PROFILE_SLUGS.portalHome),
    contactForm: PORTAL_CONTACT_SEED.form,
  };
}

export function getPrerenderPortalAgensiData(): PortalAgensiLoaderData {
  const creatorHandle = resolveAgensiCreatorHandle();
  return {
    content: PORTAL_AGENSI_SEED,
    skills: AGENSI_SKILL_SEEDS.toSorted((a, b) => a.sortOrder - b.sortOrder).map(skill =>
      AgensiSkillSchema.parse({
        ...skill,
        tags: [...skill.tags],
        creatorHandle,
        isPublished: true,
        syncedAt: null,
        source: 'prerender',
      }),
    ),
    catalogMeta: {
      mode: 'prerender',
      creatorHandle,
      syncedAt: null,
    },
  };
}

export function getPrerenderPortalAskData(): PortalAskLoaderData {
  return {
    content: PORTAL_ASK_SEED,
    quota: DEFAULT_GUEST_QUOTA,
  };
}

export function getPrerenderPortalCadenceData(): PortalCadenceLoaderData {
  return {
    content: PORTAL_CADENCE_SEED,
    presets: CADENCE_PRESET_SEEDS.toSorted((a, b) => a.sortOrder - b.sortOrder).map(preset =>
      CadencePresetSchema.parse(preset),
    ),
    quota: DEFAULT_GUEST_QUOTA,
    recentRuns: [],
    goldenRuns: getPrerenderGoldenSandboxRuns(),
  };
}

export function getPrerenderPortalContactData(): PortalContactLoaderData {
  return {
    content: PORTAL_CONTACT_SEED,
  };
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
  window: AdminAnalyticsWindow = '7d',
): AdminAnalyticsSummaryData {
  return {
    content: ADMIN_ANALYTICS_SEED,
    window,
    totalSessions: 0,
    totalEvents: 0,
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
  };
}

export function getPrerenderAdminAnalyticsData(
  window: AdminAnalyticsWindow = '7d',
): AdminAnalyticsLoaderData {
  return {
    ...getPrerenderAdminAnalyticsSummaryData(window),
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

export function loadPortalRootDataWithPrerender(
  maintenanceModeOverride?: boolean,
): Promise<PortalRootLoaderData> {
  return withPrerenderFallback(
    db => loadPortalRootData(db, maintenanceModeOverride),
    () => getPrerenderPortalRootData(maintenanceModeOverride),
  );
}

export function loadPortalHomeDataWithPrerender(): Promise<PortalHomeLoaderData> {
  return withPrerenderFallback(loadPortalHomeData, getPrerenderPortalHomeData);
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

export function loadPortalMaintenanceDataWithPrerender(): Promise<PortalMaintenanceLoaderData> {
  return withPrerenderFallback(loadPortalMaintenanceData, getPrerenderPortalMaintenanceData);
}

export function loadAdminRootDataWithPrerender(): Promise<AdminRootLoaderData> {
  return withPrerenderFallback(loadAdminRootData, getPrerenderAdminRootData);
}

export function loadAdminHomeDataWithPrerender(): Promise<AdminHomeLoaderData> {
  return withPrerenderFallback(loadAdminHomeData, getPrerenderAdminHomeData);
}

export function loadAdminAnalyticsSummaryWithPrerender(
  window: AdminAnalyticsWindow = '7d',
): Promise<AdminAnalyticsSummaryData> {
  return withPrerenderFallback(
    db => loadAdminAnalyticsSummary(db, window),
    () => getPrerenderAdminAnalyticsSummaryData(window),
  );
}

export function loadAdminAnalyticsBreakdownsWithPrerender(
  window: AdminAnalyticsWindow = '7d',
): Promise<AdminAnalyticsBreakdownsData> {
  return withPrerenderFallback(
    db => loadAdminAnalyticsBreakdowns(db, window),
    getPrerenderAdminAnalyticsBreakdownsData,
  );
}

export function loadAdminAnalyticsDataWithPrerender(
  window: AdminAnalyticsWindow = '7d',
): Promise<AdminAnalyticsLoaderData> {
  return withPrerenderFallback(
    db => loadAdminAnalyticsData(db, window),
    () => getPrerenderAdminAnalyticsData(window),
  );
}
