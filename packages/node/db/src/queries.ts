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
  type ContactFormSubmission,
  ContactFormSubmissionSchema,
  type ContactSubmissionSummary,
  type FormFieldErrorMap,
  type MenuItem,
  MenuItemSchema,
  type PortalCadenceLoaderData,
  PortalCadenceContentSchema,
  type PortalChromeContent,
  PortalChromeContentSchema,
  type PortalContactLoaderData,
  PortalContactContentSchema,
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
  portalContact: 'portal-contact',
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
  if (maintenanceMode) {
    const maintenance = await loadPortalMaintenanceData(db);
    return {
      maintenanceMode,
      chrome,
      maintenance,
    };
  }

  const { content: homeContent, terminal, contactForm } = await loadPortalHomeData(db);
  return {
    maintenanceMode,
    chrome,
    maintenance: null,
    terminal,
    homeContent,
    contactForm,
  };
}

export async function loadPortalHomeData(db: AppDatabase): Promise<PortalHomeLoaderData> {
  const [content, terminal, contactContent] = await Promise.all([
    getSiteContent(db, SITE_CONTENT_KEYS.portalHome, PortalHomeContentSchema),
    getTerminalProfile(db, TERMINAL_PROFILE_SLUGS.portalHome),
    getSiteContent(db, SITE_CONTENT_KEYS.portalContact, PortalContactContentSchema),
  ]);

  return { content, terminal, contactForm: contactContent.form };
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

export async function loadPortalContactData(db: AppDatabase): Promise<PortalContactLoaderData> {
  const content = await getSiteContent(
    db,
    SITE_CONTENT_KEYS.portalContact,
    PortalContactContentSchema,
  );
  return { content };
}

const CONTACT_CONSTRAINT_FIELD_MAP: Readonly<Record<string, { field: string; message: string }>> = {
  contact_name_length_check: {
    field: 'name',
    message: 'Database constraint rejected Name (must be 2–120 non-whitespace characters).',
  },
  contact_phone_format_check: {
    field: 'phone',
    message: 'Database constraint rejected Phone format.',
  },
  contact_email_format_check: {
    field: 'email',
    message: 'Database constraint rejected Email format.',
  },
  contact_message_length_check: {
    field: 'message',
    message: 'Database constraint rejected Message (must be 10–4000 non-whitespace characters).',
  },
  contact_attachment_consistency_check: {
    field: 'file',
    message: 'Database constraint rejected File attachment metadata or size.',
  },
};

export class ContactDbConstraintError extends Error {
  readonly constraintName: string;
  readonly fieldErrors: FormFieldErrorMap;

  constructor(constraintName: string, fieldErrors: FormFieldErrorMap, message: string) {
    super(message);
    this.name = 'ContactDbConstraintError';
    this.constraintName = constraintName;
    this.fieldErrors = fieldErrors;
  }
}

interface PgErrorShape {
  code?: string;
  constraint?: string;
  column?: string;
  cause?: PgErrorShape;
}

export function extractPgConstraintViolation(error: unknown): ContactDbConstraintError | null {
  if (!error || typeof error !== 'object') return null;
  const err = error as PgErrorShape;
  const pgErr = err.code ? err : err.cause;
  if (!pgErr || (pgErr.code !== '23514' && pgErr.code !== '23502')) {
    return null;
  }
  const constraintName = pgErr.constraint ?? pgErr.column ?? 'unknown_constraint';
  const mapped = CONTACT_CONSTRAINT_FIELD_MAP[constraintName];
  if (mapped) {
    return new ContactDbConstraintError(
      constraintName,
      { [mapped.field]: [mapped.message] },
      mapped.message,
    );
  }
  if (pgErr.code === '23502' && pgErr.column) {
    const field = pgErr.column.startsWith('attachment_') ? 'file' : pgErr.column;
    const message = `Database NOT NULL constraint rejected missing field "${pgErr.column}".`;
    return new ContactDbConstraintError(constraintName, { [field]: [message] }, message);
  }
  return new ContactDbConstraintError(
    constraintName,
    {},
    `Database constraint violation (${constraintName}).`,
  );
}

export async function insertContactSubmission(
  db: AppDatabase,
  submission: ContactFormSubmission,
): Promise<ContactSubmissionSummary> {
  const parsed = ContactFormSubmissionSchema.parse(submission);
  let inserted:
    | {
        id: string;
        name: string;
        email: string;
        phone: string | null;
        attachmentName: string | null;
        attachmentSizeBytes: number | null;
        attachmentSha256: string | null;
        createdAt: Date;
      }
    | undefined;

  try {
    [inserted] = await db
      .insert(schema.contactSubmissions)
      .values({
        name: parsed.name,
        phone: parsed.phone,
        email: parsed.email,
        message: parsed.message,
        attachmentName: parsed.attachment?.filename ?? null,
        attachmentMimeType: parsed.attachment?.mimeType ?? null,
        attachmentSizeBytes: parsed.attachment?.sizeBytes ?? null,
        attachmentSha256: parsed.attachment?.sha256 ?? null,
        attachmentContentBase64: parsed.attachment?.contentBase64 ?? null,
      })
      .returning({
        id: schema.contactSubmissions.id,
        name: schema.contactSubmissions.name,
        email: schema.contactSubmissions.email,
        phone: schema.contactSubmissions.phone,
        attachmentName: schema.contactSubmissions.attachmentName,
        attachmentSizeBytes: schema.contactSubmissions.attachmentSizeBytes,
        attachmentSha256: schema.contactSubmissions.attachmentSha256,
        createdAt: schema.contactSubmissions.createdAt,
      });
  } catch (error) {
    const mapped = extractPgConstraintViolation(error);
    if (mapped) {
      throw mapped;
    }
    throw error;
  }

  if (!inserted) {
    throw new Error('Failed to persist contact submission in Postgres');
  }

  return {
    id: inserted.id,
    name: inserted.name,
    email: inserted.email,
    phone: inserted.phone,
    attachmentName: inserted.attachmentName,
    attachmentSizeBytes: inserted.attachmentSizeBytes,
    attachmentSha256: inserted.attachmentSha256,
    createdAt: inserted.createdAt.toISOString(),
  };
}

export const ADMIN_OPS_TERMINAL_PROFILE: TerminalProfileData = TerminalProfileDataSchema.parse({
  slug: 'admin-ops',
  bannerTitle: 'Solar Forge Ops Terminal // admin',
  bannerMeta: 'ops tty · type "help" or press Tab',
  osLabel: '⚡',
  directory: '~/admin.andrew-k.us',
  vcsBranch: 'ops-isolated',
  vcsState: 'clean',
  contextLabel: 'admin@andrew-k.us',
  placeholder: 'type an ops command (help, analytics, home, status, clear)',
  quickCommands: ['help', 'analytics', 'home', 'status', 'clear'],
  initialEntries: [
    {
      command: 'status',
      output: 'admin.andrew-k.us :: isolated ops console ready · Ghostty split panes enabled.',
      status: 'ok',
      durationLabel: '3ms',
      timestamp: '00:00:00',
      sortOrder: 0,
    },
  ],
  commands: [
    {
      name: 'help',
      description: 'list available ops commands',
      kind: 'static',
      output: [
        'Available admin ops commands:',
        '  help      — list available ops commands',
        '  home      — open Admin Operations Console (/)',
        '  analytics — open First-Party Visitor Analytics (/analytics)',
        '  status    — print isolated ops status',
        '  whoami    — print active ops identity',
        '  clear     — clear terminal scrollback',
      ].join('\n'),
      targetRoute: null,
      allowedRoutes: [],
      errorTemplate: null,
      sortOrder: 1,
    },
    {
      name: 'home',
      description: 'open Admin Operations Console (/)',
      kind: 'navigate',
      output: 'opening / ...',
      targetRoute: '/',
      allowedRoutes: [],
      errorTemplate: null,
      sortOrder: 2,
    },
    {
      name: 'analytics',
      description: 'open First-Party Visitor Analytics (/analytics)',
      kind: 'navigate',
      output: 'opening /analytics ...',
      targetRoute: '/analytics',
      allowedRoutes: [],
      errorTemplate: null,
      sortOrder: 3,
    },
    {
      name: 'status',
      description: 'print isolated ops status',
      kind: 'static',
      output:
        'SURFACE : admin.andrew-k.us (noindex, nofollow, noarchive)\nAUTH    : WebAuthn passkey gate · Postgres 19 telemetry active',
      targetRoute: null,
      allowedRoutes: [],
      errorTemplate: null,
      sortOrder: 4,
    },
    {
      name: 'whoami',
      description: 'print active ops identity',
      kind: 'static',
      output: 'admin@andrew-k.us (isolated ops shell)',
      targetRoute: null,
      allowedRoutes: [],
      errorTemplate: null,
      sortOrder: 5,
    },
    {
      name: 'clear',
      description: 'clear terminal scrollback',
      kind: 'clear',
      output: '',
      targetRoute: null,
      allowedRoutes: [],
      errorTemplate: null,
      sortOrder: 6,
    },
  ],
});

export async function loadAdminRootData(db: AppDatabase): Promise<AdminRootLoaderData> {
  const chrome: AdminChromeContent = await getSiteContent(
    db,
    SITE_CONTENT_KEYS.adminChrome,
    AdminChromeContentSchema,
  );

  return { chrome, terminal: ADMIN_OPS_TERMINAL_PROFILE };
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
