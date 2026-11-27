import {
  type AdminAnalyticsBreakdownsData,
  type AdminAnalyticsLoaderData,
  type AdminAnalyticsSummaryData,
  type AdminHomeLoaderData,
  type AdminRootLoaderData,
  AgensiSkillSchema,
  CadencePresetSchema,
  CareerDossierSchema,
  MenuItemSchema,
  type PortalAboutLoaderData,
  type PortalAgensiLoaderData,
  type PortalAskLoaderData,
  type PortalCadenceLoaderData,
  type PortalContactLoaderData,
  type PortalHomeLoaderData,
  type PortalRootLoaderData,
  type QuotaStatus,
} from '@aklapper/core';
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
  TERMINAL_PROFILE_SLUGS,
} from './queries.ts';
import { CAREER_DOSSIER_SEEDS } from './seed-dossiers.ts';
import { getPrerenderGoldenSandboxRuns } from './seed-golden-runs.ts';
import {
  ADMIN_ANALYTICS_SEED,
  ADMIN_CHROME_SEED,
  ADMIN_HOME_SEED,
  AGENSI_SKILL_SEEDS,
  buildSeedTerminalProfile,
  CADENCE_PRESET_SEEDS,
  DEFAULT_MENU_ITEMS,
  PORTAL_ABOUT_SEED,
  PORTAL_AGENSI_SEED,
  PORTAL_ASK_SEED,
  PORTAL_CADENCE_SEED,
  PORTAL_CHROME_SEED,
  PORTAL_CONTACT_SEED,
  PORTAL_HOME_SEED,
} from './seed.ts';

const DEFAULT_GUEST_QUOTA: QuotaStatus = {
  role: 'guest',
  turnsUsed: 0,
  maxTurns: 10,
  tokensUsed: 0,
  maxTokens: 40_000,
};

export function getPrerenderPortalRootData(): PortalRootLoaderData {
  const { content: homeContent, terminal, contactForm } = getPrerenderPortalHomeData();
  return {
    chrome: PORTAL_CHROME_SEED,
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

export function getPrerenderPortalAboutData(): PortalAboutLoaderData {
  console.info(
    JSON.stringify({
      event: 'portal.about.loader_source_branch',
      seamType: 'RULE_DIVERGENCE',
      branch: 'prerender_seed_fallback',
      dossierCount: CAREER_DOSSIER_SEEDS.length,
    }),
  );

  return {
    content: PORTAL_ABOUT_SEED,
    dossiers: CAREER_DOSSIER_SEEDS.toSorted((a, b) => a.sortOrder - b.sortOrder).map(dossier =>
      CareerDossierSchema.parse({
        slug: dossier.slug,
        kind: dossier.kind,
        title: dossier.title,
        domainLabel: dossier.domainLabel,
        roleTitle: dossier.roleTitle,
        timeframe: dossier.timeframe,
        skills: [...dossier.skills],
        summaryBody: dossier.summaryBody,
        sections: dossier.sectionsJson.map(section => ({
          heading: section.heading,
          body: section.body,
        })),
        publishStatus: dossier.publishStatus,
        sanitizationVerifiedAt: dossier.sanitizationVerifiedAt.toISOString(),
        denylistHash: dossier.denylistHash,
        sortOrder: dossier.sortOrder,
        updatedAt: dossier.sanitizationVerifiedAt.toISOString(),
      }),
    ),
    ...(PORTAL_CHROME_SEED.brandContactEmail
      ? { brandContactEmail: PORTAL_CHROME_SEED.brandContactEmail }
      : {}),
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
