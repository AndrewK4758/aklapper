import {
  AdminChromeContentSchema,
  type AdminHomeLoaderData,
  AdminHomeContentSchema,
  type AdminRootLoaderData,
  type AgensiSkill,
  type AnalyticsBatch,
  AnalyticsBatchSchema,
  type AuthSession,
  AuthSessionSchema,
  type CadenceGateVerdict,
  type CadencePreset,
  CadencePresetSchema,
  type CadenceRunResult,
  CadenceRunResultSchema,
  type CadenceTurn,
  type ContactFormSubmission,
  ContactFormSubmissionSchema,
  type ContactSubmissionSummary,
  type FormFieldErrorMap,
  type MenuItem,
  MenuItemSchema,
  PortalAgensiContentSchema,
  type PortalAgensiLoaderData,
  PortalAskContentSchema,
  type PortalAskLoaderData,
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
  type QuotaStatus,
  QuotaStatusSchema,
  type RoadmapMilestone,
  RoadmapMilestoneSchema,
  type Role,
  SITE_CONTENT_KEYS,
  type TerminalDirectoryEntry,
  TerminalDirectoryEntrySchema,
  type TerminalProfileData,
  TerminalProfileDataSchema,
  formatTerminalDirectoryListing,
} from '@aklapper/core';
import { resolveAgensiCreatorHandle } from '@aklapper/node-runtime/agensi';
import { and, asc, count, desc, eq, gt, isNull, sql } from 'drizzle-orm';
import type { z } from 'zod';

import { loadCreatorAgensiCatalog } from './agensi-loader.ts';
import { type AgensiSyncOptions, queryCreatorPublishedSkills } from './agensi-sync.ts';
import type { AppDatabase } from './client.ts';
import {
  mapSandboxTurnRow,
  normalizeGateVerdict,
  updateSandboxRunGateVerdictRow,
} from './sandbox-helpers.ts';
import * as schema from './schema.ts';

export {
  type AdminPasswordUserRecord,
  countUserWebauthnCredentials,
  findAdminUserForPasswordLogin,
  type UpsertAdminPasswordInput,
  type UpsertAdminPasswordResult,
  upsertAdminUserPassword,
} from './auth-queries.ts';
export {
  type AuthRateLimitOptions,
  type AuthRateLimitResult,
  consumeAuthRateLimit,
} from './auth-rate-limit.ts';

export { SITE_CONTENT_KEYS };

export const TERMINAL_PROFILE_SLUGS = {
  portalHome: 'portal-home',
  portalMaintenance: 'portal-maintenance',
  adminOps: 'admin-ops',
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

export async function getTerminalDirectoryEntries(
  db: AppDatabase,
  profileSlug: string,
): Promise<TerminalDirectoryEntry[]> {
  const rows = await db
    .select()
    .from(schema.terminalDirectoryEntries)
    .where(
      and(
        eq(schema.terminalDirectoryEntries.profileSlug, profileSlug),
        eq(schema.terminalDirectoryEntries.enabled, true),
      ),
    )
    .orderBy(
      asc(schema.terminalDirectoryEntries.sortOrder),
      asc(schema.terminalDirectoryEntries.id),
    );

  return rows.map(row =>
    TerminalDirectoryEntrySchema.parse({
      name: row.name,
      description: row.description,
      sortOrder: row.sortOrder,
      enabled: row.enabled,
    }),
  );
}

export function resolveTerminalLsOutput(
  commandName: string,
  fallbackOutput: string,
  directoryListing: string | null,
): string {
  if (directoryListing !== null && commandName.trim() === 'ls') {
    return directoryListing;
  }
  return fallbackOutput;
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

  const [entryRows, commandRows, directoryEntries] = await Promise.all([
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
    getTerminalDirectoryEntries(db, slug),
  ]);

  const directoryListing =
    directoryEntries.length > 0 ? formatTerminalDirectoryListing(directoryEntries) : null;

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
      output: resolveTerminalLsOutput(entry.command, entry.output, directoryListing),
      status: entry.status,
      durationLabel: entry.durationLabel,
      timestamp: entry.timestampLabel,
      sortOrder: entry.sortOrder,
    })),
    commands: commandRows.map(cmd => ({
      name: cmd.name,
      description: cmd.description,
      kind: cmd.kind,
      output: resolveTerminalLsOutput(cmd.name, cmd.output, directoryListing),
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

export async function getAgensiSkills(
  db: AppDatabase,
  creatorHandle = resolveAgensiCreatorHandle(),
): Promise<AgensiSkill[]> {
  return queryCreatorPublishedSkills(db, creatorHandle);
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

export async function loadPortalAgensiData(
  db: AppDatabase,
  options: AgensiSyncOptions = {},
): Promise<PortalAgensiLoaderData> {
  const [content, catalog] = await Promise.all([
    getSiteContent(db, SITE_CONTENT_KEYS.portalAgensi, PortalAgensiContentSchema),
    loadCreatorAgensiCatalog(db, options),
  ]);

  return {
    content: catalog.statusBadgeOverride
      ? {
          ...content,
          statusBadge: catalog.statusBadgeOverride,
        }
      : content,
    skills: catalog.skills,
    catalogMeta: catalog.catalogMeta,
  };
}

export async function loadPortalAskData(
  db: AppDatabase,
  sessionId?: string,
): Promise<PortalAskLoaderData> {
  const [content, quota] = await Promise.all([
    getSiteContent(db, SITE_CONTENT_KEYS.portalAsk, PortalAskContentSchema),
    getQuotaStatusForSession(db, 'guest', sessionId),
  ]);

  return { content, quota };
}

export async function loadPortalCadenceData(
  db: AppDatabase,
  sessionId?: string,
): Promise<PortalCadenceLoaderData> {
  const [content, presets, quota, recentRuns] = await Promise.all([
    getSiteContent(db, SITE_CONTENT_KEYS.portalCadence, PortalCadenceContentSchema),
    getCadencePresets(db),
    getQuotaStatusForSession(db, 'guest', sessionId),
    sessionId ? listSandboxRunsForSession(db, sessionId, 8) : Promise.resolve([]),
  ]);

  if (presets.length === 0) {
    throw new Error('Missing required cadence_presets rows in Postgres');
  }

  return { content, presets, quota, recentRuns };
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

export async function loadAdminRootData(db: AppDatabase): Promise<AdminRootLoaderData> {
  const [chrome, terminal] = await Promise.all([
    getSiteContent(db, SITE_CONTENT_KEYS.adminChrome, AdminChromeContentSchema),
    getTerminalProfile(db, TERMINAL_PROFILE_SLUGS.adminOps),
  ]);

  return { chrome, terminal };
}

export async function loadAdminHomeData(db: AppDatabase): Promise<AdminHomeLoaderData> {
  const [content, items] = await Promise.all([
    getSiteContent(db, SITE_CONTENT_KEYS.adminHome, AdminHomeContentSchema),
    getMenuItems(db, { includeAdminOnly: true, includeDisabled: true }),
  ]);

  return { content, menuItems: items };
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface AuthUserRecord {
  id: string;
  handle: string;
  role: Role;
  createdAt: Date;
}

export interface ValidAuthSessionRecord {
  session: AuthSession;
  userId: string | null;
  totpEnabled: boolean;
  passkeyCount: number;
}

export interface WebauthnChallengeRecord {
  id: string;
  challenge: string;
  userId: string | null;
  kind: 'register' | 'login';
  expiresAt: Date;
  consumedAt: Date | null;
  createdAt: Date;
}

export interface WebauthnCredentialRecord {
  credentialId: string;
  userId: string;
  publicKey: string;
  counter: number;
  transports: string[];
  createdAt: Date;
}

export interface TotpSecretRecord {
  userId: string;
  encryptedSecret: string;
  enabled: boolean;
  backupCodesHash: string[];
}

export async function findOrCreateAdminUser(
  db: AppDatabase,
  handle = 'admin',
): Promise<AuthUserRecord> {
  const normalizedHandle = handle.trim().toLowerCase() || 'admin';

  await db
    .insert(schema.users)
    .values({
      handle: normalizedHandle,
      role: 'admin',
    })
    .onConflictDoNothing({ target: schema.users.handle });

  const [existing] = await db
    .select({
      id: schema.users.id,
      handle: schema.users.handle,
      role: schema.users.role,
      createdAt: schema.users.createdAt,
    })
    .from(schema.users)
    .where(eq(schema.users.handle, normalizedHandle))
    .limit(1);

  if (!existing) {
    throw new Error(`Failed to find or create admin user "${normalizedHandle}"`);
  }

  if (existing.role !== 'admin') {
    const [updated] = await db
      .update(schema.users)
      .set({ role: 'admin' })
      .where(eq(schema.users.id, existing.id))
      .returning({
        id: schema.users.id,
        handle: schema.users.handle,
        role: schema.users.role,
        createdAt: schema.users.createdAt,
      });
    if (updated) return updated;
  }

  return existing;
}

export async function getUserById(db: AppDatabase, userId: string): Promise<AuthUserRecord | null> {
  if (!UUID_PATTERN.test(userId)) return null;
  const [row] = await db
    .select({
      id: schema.users.id,
      handle: schema.users.handle,
      role: schema.users.role,
      createdAt: schema.users.createdAt,
    })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  return row ?? null;
}

export async function findAdminUser(
  db: AppDatabase,
  handle?: string,
): Promise<AuthUserRecord | null> {
  const normalizedHandle = handle?.trim().toLowerCase();
  const [row] = await db
    .select({
      id: schema.users.id,
      handle: schema.users.handle,
      role: schema.users.role,
      createdAt: schema.users.createdAt,
    })
    .from(schema.users)
    .where(
      normalizedHandle
        ? and(eq(schema.users.role, 'admin'), eq(schema.users.handle, normalizedHandle))
        : eq(schema.users.role, 'admin'),
    )
    .orderBy(asc(schema.users.createdAt))
    .limit(1);

  return row ?? null;
}

export interface CreateAuthSessionInput {
  userId: string | null;
  role: Role;
  handle?: string;
  ttlMs: number;
}

export async function createAuthSession(
  db: AppDatabase,
  input: CreateAuthSessionInput,
): Promise<AuthSession> {
  const expiresAt = new Date(Date.now() + input.ttlMs);
  const [inserted] = await db
    .insert(schema.authSessions)
    .values({
      userId: input.userId,
      role: input.role,
      expiresAt,
    })
    .returning({
      id: schema.authSessions.id,
      role: schema.authSessions.role,
      expiresAt: schema.authSessions.expiresAt,
    });

  if (!inserted) {
    throw new Error('Failed to create auth session in Postgres');
  }

  let handle = input.handle?.trim() || (input.role === 'guest' ? 'guest' : 'admin');
  if (!input.handle && input.userId) {
    const user = await getUserById(db, input.userId);
    if (user) handle = user.handle;
  }

  return AuthSessionSchema.parse({
    sessionId: inserted.id,
    role: inserted.role,
    handle,
    expiresAt: inserted.expiresAt.toISOString(),
  });
}

export async function getValidAuthSession(
  db: AppDatabase,
  sessionId: string | null | undefined,
): Promise<ValidAuthSessionRecord | null> {
  if (!sessionId || !UUID_PATTERN.test(sessionId)) {
    return null;
  }

  const now = new Date();
  const [row] = await db
    .select({
      id: schema.authSessions.id,
      userId: schema.authSessions.userId,
      role: schema.authSessions.role,
      expiresAt: schema.authSessions.expiresAt,
      userHandle: schema.users.handle,
    })
    .from(schema.authSessions)
    .leftJoin(schema.users, eq(schema.authSessions.userId, schema.users.id))
    .where(
      and(
        eq(schema.authSessions.id, sessionId),
        isNull(schema.authSessions.revokedAt),
        gt(schema.authSessions.expiresAt, now),
      ),
    )
    .limit(1);

  if (!row) return null;

  let totpEnabled = false;
  let passkeyCount = 0;

  if (row.userId) {
    const [totpRow, credCountRows] = await Promise.all([
      db
        .select({ enabled: schema.totpSecrets.enabled })
        .from(schema.totpSecrets)
        .where(eq(schema.totpSecrets.userId, row.userId))
        .limit(1),
      db
        .select({ total: count() })
        .from(schema.webauthnCredentials)
        .where(eq(schema.webauthnCredentials.userId, row.userId)),
    ]);
    totpEnabled = Boolean(totpRow[0]?.enabled);
    passkeyCount = credCountRows[0]?.total ?? 0;
  }

  const session = AuthSessionSchema.parse({
    sessionId: row.id,
    role: row.role,
    handle: row.userHandle ?? (row.role === 'guest' ? 'guest' : 'admin'),
    expiresAt: row.expiresAt.toISOString(),
  });

  return {
    session,
    userId: row.userId,
    totpEnabled,
    passkeyCount,
  };
}

export async function revokeAuthSession(
  db: AppDatabase,
  sessionId: string | null | undefined,
): Promise<boolean> {
  if (!sessionId || !UUID_PATTERN.test(sessionId)) {
    return false;
  }
  const updated = await db
    .update(schema.authSessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(schema.authSessions.id, sessionId), isNull(schema.authSessions.revokedAt)))
    .returning({ id: schema.authSessions.id });
  return updated.length > 0;
}

export interface CreateWebauthnChallengeInput {
  challenge: string;
  userId: string | null;
  kind: 'register' | 'login';
  ttlMs?: number;
}

export async function createWebauthnChallenge(
  db: AppDatabase,
  input: CreateWebauthnChallengeInput,
): Promise<WebauthnChallengeRecord> {
  const expiresAt = new Date(Date.now() + (input.ttlMs ?? 5 * 60 * 1000));
  const [inserted] = await db
    .insert(schema.webauthnChallenges)
    .values({
      challenge: input.challenge,
      userId: input.userId,
      kind: input.kind,
      expiresAt,
    })
    .returning();

  if (!inserted) {
    throw new Error('Failed to persist WebAuthn challenge in Postgres');
  }
  return inserted;
}

export interface ConsumeWebauthnChallengeInput {
  challengeId: string;
  kind: 'register' | 'login';
}

export async function consumeWebauthnChallenge(
  db: AppDatabase,
  input: ConsumeWebauthnChallengeInput,
): Promise<WebauthnChallengeRecord | null> {
  if (!UUID_PATTERN.test(input.challengeId)) {
    return null;
  }
  const now = new Date();
  const [consumed] = await db
    .update(schema.webauthnChallenges)
    .set({ consumedAt: now })
    .where(
      and(
        eq(schema.webauthnChallenges.id, input.challengeId),
        eq(schema.webauthnChallenges.kind, input.kind),
        isNull(schema.webauthnChallenges.consumedAt),
        gt(schema.webauthnChallenges.expiresAt, now),
      ),
    )
    .returning();

  return consumed ?? null;
}

export async function listUserWebauthnCredentials(
  db: AppDatabase,
  userId: string,
): Promise<WebauthnCredentialRecord[]> {
  if (!UUID_PATTERN.test(userId)) return [];
  return db
    .select()
    .from(schema.webauthnCredentials)
    .where(eq(schema.webauthnCredentials.userId, userId))
    .orderBy(asc(schema.webauthnCredentials.createdAt));
}

export async function getWebauthnCredentialById(
  db: AppDatabase,
  credentialId: string,
): Promise<WebauthnCredentialRecord | null> {
  const [row] = await db
    .select()
    .from(schema.webauthnCredentials)
    .where(eq(schema.webauthnCredentials.credentialId, credentialId))
    .limit(1);
  return row ?? null;
}

export interface SaveWebauthnCredentialInput {
  credentialId: string;
  userId: string;
  publicKey: string;
  counter: number;
  transports?: string[];
}

export async function saveWebauthnCredential(
  db: AppDatabase,
  input: SaveWebauthnCredentialInput,
): Promise<WebauthnCredentialRecord> {
  const [inserted] = await db
    .insert(schema.webauthnCredentials)
    .values({
      credentialId: input.credentialId,
      userId: input.userId,
      publicKey: input.publicKey,
      counter: input.counter,
      transports: input.transports ?? [],
    })
    .onConflictDoUpdate({
      target: schema.webauthnCredentials.credentialId,
      set: {
        publicKey: input.publicKey,
        counter: input.counter,
        transports: input.transports ?? [],
      },
    })
    .returning();

  if (!inserted) {
    throw new Error('Failed to save WebAuthn credential in Postgres');
  }
  return inserted;
}

export async function updateWebauthnCredentialCounter(
  db: AppDatabase,
  credentialId: string,
  counter: number,
): Promise<void> {
  await db
    .update(schema.webauthnCredentials)
    .set({ counter })
    .where(eq(schema.webauthnCredentials.credentialId, credentialId));
}

export async function getUserTotpSecret(
  db: AppDatabase,
  userId: string,
): Promise<TotpSecretRecord | null> {
  if (!UUID_PATTERN.test(userId)) return null;
  const [row] = await db
    .select()
    .from(schema.totpSecrets)
    .where(eq(schema.totpSecrets.userId, userId))
    .limit(1);
  return row ?? null;
}

export interface UpsertUserTotpSecretInput {
  userId: string;
  encryptedSecret: string;
  backupCodesHash: string[];
  enabled?: boolean;
}

export async function upsertUserTotpSecret(
  db: AppDatabase,
  input: UpsertUserTotpSecretInput,
): Promise<TotpSecretRecord> {
  const [row] = await db
    .insert(schema.totpSecrets)
    .values({
      userId: input.userId,
      encryptedSecret: input.encryptedSecret,
      backupCodesHash: input.backupCodesHash,
      enabled: input.enabled ?? false,
    })
    .onConflictDoUpdate({
      target: schema.totpSecrets.userId,
      set: {
        encryptedSecret: input.encryptedSecret,
        backupCodesHash: input.backupCodesHash,
        enabled: input.enabled ?? false,
      },
    })
    .returning();

  if (!row) {
    throw new Error('Failed to persist TOTP secret in Postgres');
  }
  return row;
}

export async function enableUserTotpSecret(db: AppDatabase, userId: string): Promise<boolean> {
  if (!UUID_PATTERN.test(userId)) return false;
  const updated = await db
    .update(schema.totpSecrets)
    .set({ enabled: true })
    .where(eq(schema.totpSecrets.userId, userId))
    .returning({ userId: schema.totpSecrets.userId });
  return updated.length > 0;
}

export async function consumeTotpBackupCode(
  db: AppDatabase,
  userId: string,
  remainingHashes: string[],
): Promise<void> {
  if (!UUID_PATTERN.test(userId)) return;
  await db
    .update(schema.totpSecrets)
    .set({ backupCodesHash: remainingHashes })
    .where(eq(schema.totpSecrets.userId, userId));
}

export async function disableUserTotpSecret(db: AppDatabase, userId: string): Promise<boolean> {
  if (!UUID_PATTERN.test(userId)) return false;
  const deleted = await db
    .delete(schema.totpSecrets)
    .where(eq(schema.totpSecrets.userId, userId))
    .returning({ userId: schema.totpSecrets.userId });
  return deleted.length > 0;
}

export interface IngestAnalyticsMeta {
  ipHash: string;
  country?: string | null;
  region?: string | null;
}

export interface IngestAnalyticsResult {
  accepted: number;
  sessionId: string;
  ipHash: string;
}

export async function ingestAnalyticsBatch(
  db: AppDatabase,
  batch: AnalyticsBatch,
  meta: IngestAnalyticsMeta,
): Promise<IngestAnalyticsResult> {
  const parsed = AnalyticsBatchSchema.parse(batch);
  const country = meta.country?.trim() || null;
  const region = meta.region?.trim() || null;

  await db
    .insert(schema.analyticsSessions)
    .values({
      sessionId: parsed.sessionId,
      ipHash: meta.ipHash,
      referrer: parsed.referrer ?? null,
      country,
      region,
    })
    .onConflictDoNothing({ target: schema.analyticsSessions.sessionId });

  await db.insert(schema.analyticsEvents).values(
    parsed.events.map(event => ({
      sessionId: parsed.sessionId,
      type: event.type,
      name: event.name,
      path: event.path,
      value: event.value ?? null,
      metadataJson: (event.metadata ?? {}) as Record<string, unknown>,
      createdAt: new Date(event.timestamp),
    })),
  );

  return {
    accepted: parsed.events.length,
    sessionId: parsed.sessionId,
    ipHash: meta.ipHash,
  };
}

const DEFAULT_QUOTA_BY_ROLE: Readonly<
  Record<
    Role,
    { maxTurnsPerSession: number; maxTokensPerRun: number; maxDailyGlobalTokens: number }
  >
> = {
  guest: { maxTurnsPerSession: 5, maxTokensPerRun: 4_000, maxDailyGlobalTokens: 100_000 },
  admin: { maxTurnsPerSession: 100, maxTokensPerRun: 32_000, maxDailyGlobalTokens: 2_000_000 },
};

export async function getQuotaStatusForSession(
  db: AppDatabase,
  role: Role,
  sessionId?: string,
): Promise<QuotaStatus> {
  const [policyRow] = await db
    .select()
    .from(schema.quotaPolicies)
    .where(eq(schema.quotaPolicies.role, role))
    .limit(1);

  const policy = policyRow ?? DEFAULT_QUOTA_BY_ROLE[role];
  const maxTokens = policy.maxTokensPerRun * policy.maxTurnsPerSession;

  const trimmedSession = sessionId?.trim();
  if (!trimmedSession) {
    return QuotaStatusSchema.parse({
      role,
      turnsUsed: 0,
      maxTurns: policy.maxTurnsPerSession,
      tokensUsed: 0,
      maxTokens,
    });
  }

  const [bucket] = await db
    .select()
    .from(schema.rateLimitBuckets)
    .where(eq(schema.rateLimitBuckets.scopeKey, `session:${trimmedSession}`))
    .limit(1);

  return QuotaStatusSchema.parse({
    role,
    turnsUsed: bucket?.turnsUsed ?? 0,
    maxTurns: policy.maxTurnsPerSession,
    tokensUsed: bucket?.tokensUsed ?? 0,
    maxTokens,
  });
}

export async function consumeQuotaForSession(
  db: AppDatabase,
  role: Role,
  sessionId: string,
  turnsDelta: number,
  tokensDelta: number,
): Promise<{ allowed: boolean; quota: QuotaStatus }> {
  const trimmedSession = sessionId.trim() || 'anonymous';
  const today = new Date().toISOString().slice(0, 10);
  const sessionKey = `session:${trimmedSession}`;
  const globalKey = `global:${today}`;

  return db.transaction(async tx => {
    const [policyRow] = await tx
      .select()
      .from(schema.quotaPolicies)
      .where(eq(schema.quotaPolicies.role, role))
      .limit(1);
    const policy = policyRow ?? DEFAULT_QUOTA_BY_ROLE[role];
    const maxTokens = policy.maxTokensPerRun * policy.maxTurnsPerSession;

    for (const scopeKey of [sessionKey, globalKey]) {
      await tx
        .insert(schema.rateLimitBuckets)
        .values({ scopeKey, turnsUsed: 0, tokensUsed: 0 })
        .onConflictDoNothing({ target: schema.rateLimitBuckets.scopeKey });
    }

    const [sessionRow] = await tx
      .select()
      .from(schema.rateLimitBuckets)
      .where(eq(schema.rateLimitBuckets.scopeKey, sessionKey))
      .for('update')
      .limit(1);
    const [globalRow] = await tx
      .select()
      .from(schema.rateLimitBuckets)
      .where(eq(schema.rateLimitBuckets.scopeKey, globalKey))
      .for('update')
      .limit(1);

    const sessionTurns = sessionRow?.turnsUsed ?? 0;
    const sessionTokens = sessionRow?.tokensUsed ?? 0;
    const globalTokens = globalRow?.tokensUsed ?? 0;

    if (
      sessionTurns + turnsDelta > policy.maxTurnsPerSession ||
      tokensDelta > policy.maxTokensPerRun ||
      globalTokens + tokensDelta > policy.maxDailyGlobalTokens
    ) {
      return {
        allowed: false,
        quota: QuotaStatusSchema.parse({
          role,
          turnsUsed: sessionTurns,
          maxTurns: policy.maxTurnsPerSession,
          tokensUsed: sessionTokens,
          maxTokens,
        }),
      };
    }

    await tx
      .update(schema.rateLimitBuckets)
      .set({
        turnsUsed: sql`${schema.rateLimitBuckets.turnsUsed} + ${turnsDelta}`,
        tokensUsed: sql`${schema.rateLimitBuckets.tokensUsed} + ${tokensDelta}`,
      })
      .where(eq(schema.rateLimitBuckets.scopeKey, sessionKey));

    await tx
      .update(schema.rateLimitBuckets)
      .set({
        turnsUsed: sql`${schema.rateLimitBuckets.turnsUsed} + ${turnsDelta}`,
        tokensUsed: sql`${schema.rateLimitBuckets.tokensUsed} + ${tokensDelta}`,
      })
      .where(eq(schema.rateLimitBuckets.scopeKey, globalKey));

    return {
      allowed: true,
      quota: QuotaStatusSchema.parse({
        role,
        turnsUsed: sessionTurns + turnsDelta,
        maxTurns: policy.maxTurnsPerSession,
        tokensUsed: sessionTokens + tokensDelta,
        maxTokens,
      }),
    };
  });
}

export interface CreateSandboxRunInput {
  sessionId: string;
  ipHash: string;
  menuSlug?: string;
  prompt: string;
  presetSlug?: string;
  artifactHtml: string;
  tokensIn: number;
  tokensOut: number;
  turns: readonly Omit<CadenceTurn, 'id' | 'createdAt'>[];
}

export async function createSandboxRunWithTurns(
  db: AppDatabase,
  input: CreateSandboxRunInput,
): Promise<CadenceRunResult> {
  const [insertedRun] = await db
    .insert(schema.sandboxRuns)
    .values({
      sessionId: input.sessionId,
      ipHash: input.ipHash,
      menuSlug: input.menuSlug ?? 'cadence',
      prompt: input.prompt,
      status: 'ready',
      gateVerdict: 'pending',
      tokensIn: input.tokensIn,
      tokensOut: input.tokensOut,
      artifactHtml: input.artifactHtml,
    })
    .returning();

  if (!insertedRun) {
    throw new Error('Failed to create sandbox run in Postgres');
  }

  const insertedTurns: CadenceTurn[] = [];
  for (const turn of input.turns) {
    const [row] = await db
      .insert(schema.sandboxTurns)
      .values({
        runId: insertedRun.id,
        phase: turn.phase,
        agentName: turn.agentName,
        status: turn.status,
        payloadJson: { summary: turn.summary },
        latencyMs: turn.latencyMs,
      })
      .returning();
    if (row) {
      insertedTurns.push({
        id: row.id,
        phase: turn.phase,
        agentName: row.agentName,
        status: turn.status,
        summary: turn.summary,
        latencyMs: row.latencyMs,
        createdAt: row.createdAt.toISOString(),
      });
    }
  }

  return CadenceRunResultSchema.parse({
    runId: insertedRun.id,
    prompt: insertedRun.prompt,
    presetSlug: input.presetSlug,
    gateVerdict: insertedRun.gateVerdict,
    turns: insertedTurns,
    artifactHtml: insertedRun.artifactHtml ?? '',
    tokensIn: insertedRun.tokensIn,
    tokensOut: insertedRun.tokensOut,
    createdAt: insertedRun.createdAt.toISOString(),
  });
}

export async function listSandboxRunsForSession(
  db: AppDatabase,
  sessionId: string,
  limit = 8,
): Promise<CadenceRunResult[]> {
  const runs = await db
    .select()
    .from(schema.sandboxRuns)
    .where(eq(schema.sandboxRuns.sessionId, sessionId))
    .orderBy(desc(schema.sandboxRuns.createdAt))
    .limit(limit);

  const results: CadenceRunResult[] = [];
  for (const run of runs) {
    const turnRows = await db
      .select()
      .from(schema.sandboxTurns)
      .where(eq(schema.sandboxTurns.runId, run.id))
      .orderBy(asc(schema.sandboxTurns.id));

    const turns: CadenceTurn[] = turnRows.map(mapSandboxTurnRow);

    results.push(
      CadenceRunResultSchema.parse({
        runId: run.id,
        prompt: run.prompt,
        gateVerdict: normalizeGateVerdict(run.gateVerdict),
        turns,
        artifactHtml: run.artifactHtml ?? '',
        tokensIn: run.tokensIn,
        tokensOut: run.tokensOut,
        createdAt: run.createdAt.toISOString(),
      }),
    );
  }
  return results;
}

export async function updateSandboxRunGateVerdict(
  db: AppDatabase,
  runId: string,
  verdict: Exclude<CadenceGateVerdict, 'pending'>,
): Promise<CadenceRunResult | null> {
  const result = await updateSandboxRunGateVerdictRow(db, runId, verdict);
  if (!result) return null;

  return CadenceRunResultSchema.parse({
    runId: result.run.id,
    prompt: result.run.prompt,
    gateVerdict: verdict,
    turns: result.turns,
    artifactHtml: result.run.artifactHtml ?? '',
    tokensIn: result.run.tokensIn,
    tokensOut: result.run.tokensOut,
    createdAt: result.run.createdAt.toISOString(),
  });
}
