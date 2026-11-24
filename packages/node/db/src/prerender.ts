import {
  type AdminAnalyticsLoaderData,
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
  type PortalMenuLoaderData,
  type PortalRootLoaderData,
  type QuotaStatus,
  RoadmapMilestoneSchema,
  type TerminalProfileData,
  TerminalProfileDataSchema,
} from '@aklapper/core';

import { type AppDatabase, getSharedDb, isReactRouterPrerender } from './client.ts';
import {
  ADMIN_OPS_TERMINAL_PROFILE,
  loadAdminAnalyticsData,
  loadAdminHomeData,
  loadAdminRootData,
  loadPortalAgensiData,
  loadPortalAskData,
  loadPortalCadenceData,
  loadPortalContactData,
  loadPortalHomeData,
  loadPortalMaintenanceData,
  loadPortalMenuData,
  loadPortalRootData,
  TERMINAL_PROFILE_SLUGS,
} from './queries.ts';
import {
  ADMIN_ANALYTICS_SEED,
  ADMIN_CHROME_SEED,
  ADMIN_HOME_SEED,
  AGENSI_SKILL_SEEDS,
  CADENCE_PRESET_SEEDS,
  DEFAULT_MENU_ITEMS,
  PORTAL_AGENSI_SEED,
  PORTAL_ASK_SEED,
  PORTAL_CADENCE_SEED,
  PORTAL_CHROME_SEED,
  PORTAL_CONTACT_SEED,
  PORTAL_HOME_SEED,
  PORTAL_MAINTENANCE_SEED,
  PORTAL_MENU_SEED,
  ROADMAP_MILESTONE_SEEDS,
  TERMINAL_COMMAND_SEEDS,
  TERMINAL_INITIAL_ENTRY_SEEDS,
  TERMINAL_PROFILE_SEEDS,
} from './seed.ts';

const DEFAULT_GUEST_QUOTA: QuotaStatus = {
  role: 'guest',
  turnsUsed: 0,
  maxTurns: 5,
  tokensUsed: 0,
  maxTokens: 100_000,
};

function getSeedTerminalProfile(slug: string): TerminalProfileData {
  const profile = TERMINAL_PROFILE_SEEDS.find(item => item.slug === slug);
  if (!profile) {
    throw new Error(`Missing seed terminal profile for prerender fallback: slug="${slug}"`);
  }

  return TerminalProfileDataSchema.parse({
    slug: profile.slug,
    bannerTitle: profile.bannerTitle,
    bannerMeta: profile.bannerMeta,
    osLabel: profile.osLabel,
    directory: profile.directory,
    vcsBranch: profile.vcsBranch,
    vcsState: profile.vcsState,
    contextLabel: profile.contextLabel,
    placeholder: profile.placeholder,
    quickCommands: [...profile.quickCommands],
    initialEntries: TERMINAL_INITIAL_ENTRY_SEEDS.filter(entry => entry.profileSlug === slug)
      .toSorted((a, b) => a.sortOrder - b.sortOrder)
      .map(entry => ({
        command: entry.command,
        output: entry.output,
        status: entry.status,
        durationLabel: entry.durationLabel,
        timestamp: entry.timestampLabel,
        sortOrder: entry.sortOrder,
      })),
    commands: TERMINAL_COMMAND_SEEDS.filter(cmd => cmd.profileSlug === slug)
      .toSorted((a, b) => a.sortOrder - b.sortOrder)
      .map(cmd => ({
        name: cmd.name,
        description: cmd.description,
        kind: cmd.kind,
        output: cmd.output,
        targetRoute: cmd.targetRoute,
        allowedRoutes: [...cmd.allowedRoutes],
        errorTemplate: cmd.errorTemplate,
        sortOrder: cmd.sortOrder,
      })),
  });
}

export function getPrerenderPortalMaintenanceData(): PortalMaintenanceLoaderData {
  return {
    content: PORTAL_MAINTENANCE_SEED,
    terminal: getSeedTerminalProfile(TERMINAL_PROFILE_SLUGS.portalMaintenance),
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
    terminal: getSeedTerminalProfile(TERMINAL_PROFILE_SLUGS.portalHome),
    contactForm: PORTAL_CONTACT_SEED.form,
  };
}

export function getPrerenderPortalMenuData(): PortalMenuLoaderData {
  return {
    content: PORTAL_MENU_SEED,
    items: DEFAULT_MENU_ITEMS.filter(item => !item.adminOnly && item.enabled)
      .toSorted((a, b) => a.sortOrder - b.sortOrder)
      .map(item => MenuItemSchema.parse(item)),
  };
}

export function getPrerenderPortalAgensiData(): PortalAgensiLoaderData {
  return {
    content: PORTAL_AGENSI_SEED,
    skills: AGENSI_SKILL_SEEDS.toSorted((a, b) => a.sortOrder - b.sortOrder).map(skill =>
      AgensiSkillSchema.parse({
        ...skill,
        tags: [...skill.tags],
      }),
    ),
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
    terminal: ADMIN_OPS_TERMINAL_PROFILE,
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

export function getPrerenderAdminAnalyticsData(): AdminAnalyticsLoaderData {
  return {
    content: ADMIN_ANALYTICS_SEED,
    summary: {
      totalSessions: 0,
      totalEvents: 0,
    },
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

export function loadPortalMenuDataWithPrerender(): Promise<PortalMenuLoaderData> {
  return withPrerenderFallback(loadPortalMenuData, getPrerenderPortalMenuData);
}

export function loadPortalAgensiDataWithPrerender(): Promise<PortalAgensiLoaderData> {
  return withPrerenderFallback(loadPortalAgensiData, getPrerenderPortalAgensiData);
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

export function loadAdminAnalyticsDataWithPrerender(): Promise<AdminAnalyticsLoaderData> {
  return withPrerenderFallback(loadAdminAnalyticsData, getPrerenderAdminAnalyticsData);
}
