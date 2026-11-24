import {
  type AdminAnalyticsLoaderData,
  AdminAnalyticsContentSchema,
  type AdminChromeContent,
  AdminChromeContentSchema,
  type AdminHomeLoaderData,
  AdminHomeContentSchema,
  type AdminRootLoaderData,
  type AgensiSkill,
  AgensiSkillSchema,
  type CadencePreset,
  CadencePresetSchema,
  type MenuItem,
  MenuItemSchema,
  type PortalCadenceLoaderData,
  PortalCadenceContentSchema,
  type PortalChromeContent,
  PortalChromeContentSchema,
  type PortalHomeLoaderData,
  PortalHomeContentSchema,
  type PortalMaintenanceLoaderData,
  PortalMaintenanceContentSchema,
  type PortalMenuLoaderData,
  PortalMenuContentSchema,
  type PortalRootLoaderData,
  type RoadmapMilestone,
  RoadmapMilestoneSchema,
  type TerminalProfileData,
  TerminalProfileDataSchema,
} from '@aklapper/contracts';
import { and, asc, count, eq } from 'drizzle-orm';
import type { z } from 'zod';

import type { AppDatabase } from './client.ts';
import * as schema from './schema.ts';

export const SITE_CONTENT_KEYS = {
  portalChrome: 'portal-chrome',
  portalHome: 'portal-home',
  portalMenu: 'portal-menu',
  portalCadence: 'portal-cadence',
  portalMaintenance: 'portal-maintenance',
  adminChrome: 'admin-chrome',
  adminHome: 'admin-home',
  adminAnalytics: 'admin-analytics',
} as const;

export const TERMINAL_PROFILE_SLUGS = {
  portalHome: 'portal-home',
  portalMaintenance: 'portal-maintenance',
} as const;

export async function getSiteContent<T>(
  db: AppDatabase,
  key: string,
  contentSchema: z.ZodType<T>,
): Promise<T> {
  const [row] = await db
    .select({ metadataJson: schema.siteContent.metadataJson })
    .from(schema.siteContent)
    .where(eq(schema.siteContent.key, key))
    .limit(1);

  if (!row) {
    throw new Error(`Missing required site_content row in Postgres: key="${key}"`);
  }

  return contentSchema.parse(row.metadataJson);
}

export async function getTerminalProfile(
  db: AppDatabase,
  slug: string,
): Promise<TerminalProfileData> {
  const [profile] = await db
    .select()
    .from(schema.terminalProfiles)
    .where(eq(schema.terminalProfiles.slug, slug))
    .limit(1);

  if (!profile) {
    throw new Error(`Missing required terminal_profiles row in Postgres: slug="${slug}"`);
  }

  const [entryRows, commandRows] = await Promise.all([
    db
      .select()
      .from(schema.terminalInitialEntries)
      .where(eq(schema.terminalInitialEntries.profileSlug, slug))
      .orderBy(asc(schema.terminalInitialEntries.sortOrder), asc(schema.terminalInitialEntries.id)),
    db
      .select()
      .from(schema.terminalCommands)
      .where(eq(schema.terminalCommands.profileSlug, slug))
      .orderBy(asc(schema.terminalCommands.sortOrder), asc(schema.terminalCommands.id)),
  ]);

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
    quickCommands: profile.quickCommands,
    initialEntries: entryRows.map(entry => ({
      command: entry.command,
      output: entry.output,
      status: entry.status,
      durationLabel: entry.durationLabel,
      timestamp: entry.timestampLabel,
      sortOrder: entry.sortOrder,
    })),
    commands: commandRows.map(cmd => ({
      name: cmd.name,
      description: cmd.description,
      kind: cmd.kind,
      output: cmd.output,
      targetRoute: cmd.targetRoute,
      allowedRoutes: cmd.allowedRoutes,
      errorTemplate: cmd.errorTemplate,
      sortOrder: cmd.sortOrder,
    })),
  });
}

export interface GetMenuItemsOptions {
  includeAdminOnly?: boolean;
  includeDisabled?: boolean;
}

export async function getMenuItems(
  db: AppDatabase,
  options: GetMenuItemsOptions = {},
): Promise<MenuItem[]> {
  const { includeAdminOnly = false, includeDisabled = false } = options;
  const conditions = [];

  if (!includeAdminOnly) {
    conditions.push(eq(schema.menuItems.adminOnly, false));
  }
  if (!includeDisabled) {
    conditions.push(eq(schema.menuItems.enabled, true));
  }

  const rows =
    conditions.length > 0
      ? await db
          .select()
          .from(schema.menuItems)
          .where(and(...conditions))
          .orderBy(asc(schema.menuItems.sortOrder), asc(schema.menuItems.slug))
      : await db
          .select()
          .from(schema.menuItems)
          .orderBy(asc(schema.menuItems.sortOrder), asc(schema.menuItems.slug));

  return rows.map(row => MenuItemSchema.parse(row));
}

export async function getRoadmapMilestones(db: AppDatabase): Promise<RoadmapMilestone[]> {
  const rows = await db
    .select()
    .from(schema.roadmapMilestones)
    .where(eq(schema.roadmapMilestones.enabled, true))
    .orderBy(asc(schema.roadmapMilestones.sortOrder), asc(schema.roadmapMilestones.slug));

  return rows.map(row => RoadmapMilestoneSchema.parse(row));
}

export async function getCadencePresets(db: AppDatabase): Promise<CadencePreset[]> {
  const rows = await db
    .select()
    .from(schema.cadencePresets)
    .orderBy(asc(schema.cadencePresets.sortOrder), asc(schema.cadencePresets.slug));

  return rows.map(row => CadencePresetSchema.parse(row));
}

export async function getAgensiSkills(db: AppDatabase): Promise<AgensiSkill[]> {
  const rows = await db
    .select()
    .from(schema.agensiSkills)
    .orderBy(asc(schema.agensiSkills.sortOrder), asc(schema.agensiSkills.slug));

  return rows.map(row => AgensiSkillSchema.parse(row));
}

export async function loadPortalMaintenanceData(
  db: AppDatabase,
): Promise<PortalMaintenanceLoaderData> {
  const [content, terminal, milestones] = await Promise.all([
    getSiteContent(db, SITE_CONTENT_KEYS.portalMaintenance, PortalMaintenanceContentSchema),
    getTerminalProfile(db, TERMINAL_PROFILE_SLUGS.portalMaintenance),
    getRoadmapMilestones(db),
  ]);

  return { content, terminal, milestones };
}

export async function loadPortalRootData(
  db: AppDatabase,
  maintenanceModeOverride?: boolean,
): Promise<PortalRootLoaderData> {
  const chrome: PortalChromeContent = await getSiteContent(
    db,
    SITE_CONTENT_KEYS.portalChrome,
    PortalChromeContentSchema,
  );
  const maintenanceMode = maintenanceModeOverride ?? chrome.maintenanceModeDefault;
  const maintenance = maintenanceMode ? await loadPortalMaintenanceData(db) : null;

  return {
    maintenanceMode,
    chrome,
    maintenance,
  };
}

export async function loadPortalHomeData(db: AppDatabase): Promise<PortalHomeLoaderData> {
  const [content, terminal] = await Promise.all([
    getSiteContent(db, SITE_CONTENT_KEYS.portalHome, PortalHomeContentSchema),
    getTerminalProfile(db, TERMINAL_PROFILE_SLUGS.portalHome),
  ]);

  return { content, terminal };
}

export async function loadPortalMenuData(db: AppDatabase): Promise<PortalMenuLoaderData> {
  const [content, items] = await Promise.all([
    getSiteContent(db, SITE_CONTENT_KEYS.portalMenu, PortalMenuContentSchema),
    getMenuItems(db, { includeAdminOnly: false, includeDisabled: false }),
  ]);

  return { content, items };
}

export async function loadPortalCadenceData(db: AppDatabase): Promise<PortalCadenceLoaderData> {
  const [content, presets] = await Promise.all([
    getSiteContent(db, SITE_CONTENT_KEYS.portalCadence, PortalCadenceContentSchema),
    getCadencePresets(db),
  ]);

  if (presets.length === 0) {
    throw new Error('Missing required cadence_presets rows in Postgres');
  }

  return { content, presets };
}

export async function loadAdminRootData(db: AppDatabase): Promise<AdminRootLoaderData> {
  const chrome: AdminChromeContent = await getSiteContent(
    db,
    SITE_CONTENT_KEYS.adminChrome,
    AdminChromeContentSchema,
  );

  return { chrome };
}

export async function loadAdminHomeData(db: AppDatabase): Promise<AdminHomeLoaderData> {
  const [content, items] = await Promise.all([
    getSiteContent(db, SITE_CONTENT_KEYS.adminHome, AdminHomeContentSchema),
    getMenuItems(db, { includeAdminOnly: true, includeDisabled: true }),
  ]);

  return { content, menuItems: items };
}

export async function loadAdminAnalyticsData(db: AppDatabase): Promise<AdminAnalyticsLoaderData> {
  const [content, sessionCountRows, eventCountRows] = await Promise.all([
    getSiteContent(db, SITE_CONTENT_KEYS.adminAnalytics, AdminAnalyticsContentSchema),
    db.select({ total: count() }).from(schema.analyticsSessions),
    db.select({ total: count() }).from(schema.analyticsEvents),
  ]);

  return {
    content,
    summary: {
      totalSessions: sessionCountRows[0]?.total ?? 0,
      totalEvents: eventCountRows[0]?.total ?? 0,
    },
  };
}
