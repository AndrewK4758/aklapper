import {
  type AdminCmsLoaderData,
  AdminCmsLoaderDataSchema,
  AdminHomeContentSchema,
  type AdminInboxItem,
  AdminInboxItemSchema,
  type AdminInboxLoaderData,
  AdminInboxLoaderDataSchema,
  type AdminOverviewLoaderData,
  AdminOverviewLoaderDataSchema,
  type AdminQuotasLoaderData,
  AdminQuotasLoaderDataSchema,
  type AdminSandboxRun,
  AdminSandboxRunSchema,
  type AdminServiceHealth,
  type AdminTerminalCommandRow,
  AdminTerminalCommandRowSchema,
  type AdminTerminalDirectoryEntryRow,
  AdminTerminalDirectoryEntryRowSchema,
  type AdminTerminalInitialEntryRow,
  AdminTerminalInitialEntryRowSchema,
  type AdminTerminalProfileRow,
  AdminTerminalProfileRowSchema,
  type AgensiSkill,
  AgensiSkillSchema,
  type AgensiSkillUpsertInput,
  AgensiSkillUpsertSchema,
  AgensiSyncStateSchema,
  BucketPurgeSchema,
  BucketResetSchema,
  type CadenceGateVerdict,
  CadenceGateVerdictSchema,
  type CadencePreset,
  CadencePresetSchema,
  type CadencePresetUpsertInput,
  CadencePresetUpsertSchema,
  type CadenceTurn,
  isKnownSiteContentKey,
  type MenuItem,
  MenuItemSchema,
  type MenuItemUpsertInput,
  MenuItemUpsertSchema,
  type QuotaPolicyRecord,
  QuotaPolicyRecordSchema,
  type QuotaPolicyUpdate,
  QuotaPolicyUpdateSchema,
  RateLimitBucketRecordSchema,
  SITE_CONTENT_SCHEMA_BY_KEY,
  type SiteContentRow,
  SiteContentRowSchema,
  SiteContentUpsertSchema,
  type TerminalCommandUpsertInput,
  TerminalCommandUpsertSchema,
  type TerminalDirectoryEntryUpsertInput,
  TerminalDirectoryEntryUpsertSchema,
  type TerminalInitialEntryUpsertInput,
  TerminalInitialEntryUpsertSchema,
  type TerminalProfileUpsertInput,
  TerminalProfileUpsertSchema,
} from '@aklapper/core';
import { resolveAgensiCreatorHandle } from '@aklapper/node-runtime/agensi';
import {
  sanitizePortalAboutSiteContent,
  sanitizePortalAskSiteContent,
  sanitizePortalHomeSiteContent,
} from '@aklapper/node-runtime/privacy';
import { and, asc, count, desc, eq, gte, ilike, inArray, lte, or, sql } from 'drizzle-orm';

import { loadInboxVisitorContextMap } from './admin-inbox-visitor-context.ts';
import { queryCreatorPublishedSkills, readAgensiSyncState } from './agensi-sync.ts';
import { listCareerDossiers } from './career-dossiers.ts';
import type { AppDatabase } from './client.ts';
import { getMenuItems, getSiteContent, SITE_CONTENT_KEYS } from './queries.ts';
import {
  mapSandboxTurnRow,
  normalizeGateVerdict,
  updateSandboxRunGateVerdictRow,
} from './sandbox-helpers.ts';
import * as schema from './schema.ts';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RETIRED_MAINTENANCE_KEY = 'portal-maintenance';

function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

export {
  loadAdminAnalyticsBreakdowns,
  loadAdminAnalyticsData,
  loadAdminAnalyticsSummary,
} from './admin-analytics-queries.ts';

export interface LoadAdminOverviewOptions {
  userId?: string | null;
  handle?: string;
  passkeyCount?: number;
  totpEnabled?: boolean;
  qdrantHealth?: AdminServiceHealth;
  portfolioPublicHealth?: AdminServiceHealth;
}

export async function loadAdminOverviewData(
  db: AppDatabase,
  options: LoadAdminOverviewOptions = {},
): Promise<AdminOverviewLoaderData> {
  const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const startOfUtcDay = new Date();
  startOfUtcDay.setUTCHours(0, 0, 0, 0);

  const [
    content,
    items,
    contactCountRows,
    sessions24hRows,
    events24hRows,
    sandboxSummaryResult,
    dailyTokensResult,
    policyRows,
  ] = await Promise.all([
    getSiteContent(db, SITE_CONTENT_KEYS.adminHome, AdminHomeContentSchema),
    getMenuItems(db, { includeAdminOnly: true, includeDisabled: true }),
    db.select({ total: count() }).from(schema.contactSubmissions),
    db
      .select({ total: count() })
      .from(schema.analyticsSessions)
      .where(
        and(
          eq(schema.analyticsSessions.app, 'portal'),
          eq(schema.analyticsSessions.isBot, false),
          gte(schema.analyticsSessions.startedAt, cutoff24h),
        ),
      ),
    db.execute(sql`
      SELECT COUNT(*)::int AS total
      FROM analytics_events e
      INNER JOIN analytics_sessions s ON s.session_id = e.session_id
      WHERE s.app = 'portal'
        AND s.is_bot = false
        AND e.created_at >= ${cutoff24h}
    `),
    db.execute(sql`
      SELECT
        COUNT(*)::int AS total_runs,
        COUNT(*) FILTER (WHERE gate_verdict = 'pending')::int AS pending_gates
      FROM sandbox_runs
      WHERE is_golden = false
    `),
    db.execute(sql`
      SELECT COALESCE(SUM(tokens_in + tokens_out), 0)::bigint AS daily_tokens
      FROM sandbox_runs
      WHERE is_golden = false AND created_at >= ${startOfUtcDay}
    `),
    db.select().from(schema.quotaPolicies),
  ]);

  let passkeyCount = options.passkeyCount ?? 0;
  let totpEnabled = options.totpEnabled ?? false;
  if (
    options.userId &&
    UUID_PATTERN.test(options.userId) &&
    (options.passkeyCount === undefined || options.totpEnabled === undefined)
  ) {
    const [credRows, totpRows] = await Promise.all([
      db
        .select({ total: count() })
        .from(schema.webauthnCredentials)
        .where(eq(schema.webauthnCredentials.userId, options.userId)),
      db
        .select({ enabled: schema.totpSecrets.enabled })
        .from(schema.totpSecrets)
        .where(eq(schema.totpSecrets.userId, options.userId))
        .limit(1),
    ]);
    if (options.passkeyCount === undefined) {
      passkeyCount = credRows[0]?.total ?? 0;
    }
    if (options.totpEnabled === undefined) {
      totpEnabled = Boolean(totpRows[0]?.enabled);
    }
  }

  const events24hRow = (events24hRows.rows[0] ?? {}) as Record<string, unknown>;
  const sandboxRow = (sandboxSummaryResult.rows[0] ?? {}) as Record<string, unknown>;
  const dailyTokensRow = (dailyTokensResult.rows[0] ?? {}) as Record<string, unknown>;
  const guestPolicy = policyRows.find(row => row.role === 'guest');
  const dailyTokenCap = Math.max(1, guestPolicy?.maxDailyGlobalTokens ?? 100_000);

  return AdminOverviewLoaderDataSchema.parse({
    content,
    menuItems: items,
    health: {
      postgres: {
        name: 'PostgreSQL 19',
        status: 'ok',
        detail: `${items.length} menu routes · ${contactCountRows[0]?.total ?? 0} inbox messages`,
      },
      qdrant: options.qdrantHealth ?? {
        name: 'Qdrant Vector Store',
        status: 'offline',
        detail: 'AI_ASK_URL not configured (fail-closed)',
      },
      portfolioPublic: options.portfolioPublicHealth ?? {
        name: 'portfolio-public',
        status: 'degraded',
        detail: 'Scale-to-0 local simulation',
      },
    },
    metrics: {
      contactCount: contactCountRows[0]?.total ?? 0,
      sessions24h: sessions24hRows[0]?.total ?? 0,
      events24h: toNumber(events24hRow['total']),
      dailyTokensUsed: toNumber(dailyTokensRow['daily_tokens']),
      dailyTokenCap,
      totalSandboxRuns: toNumber(sandboxRow['total_runs']),
      pendingGates: toNumber(sandboxRow['pending_gates']),
    },
    security: {
      handle: options.handle?.trim() || 'admin',
      passkeyCount,
      totpEnabled,
    },
  });
}

export interface ListContactSubmissionsOptions {
  query?: string;
  page?: number;
  pageSize?: number;
  selectedId?: string | null;
}

export async function listContactSubmissions(
  db: AppDatabase,
  options: ListContactSubmissionsOptions = {},
): Promise<AdminInboxLoaderData> {
  const query = (options.query ?? '').trim();
  const pageSize = Math.max(1, Math.min(100, Math.floor(options.pageSize ?? 20)));
  const page = Math.max(1, Math.floor(options.page ?? 1));
  const offset = (page - 1) * pageSize;
  const rawSelectedId = options.selectedId?.trim() ?? '';
  const validSelectedId = UUID_PATTERN.test(rawSelectedId) ? rawSelectedId : null;

  const pattern = query.length > 0 ? `%${query}%` : null;
  const searchFilter = pattern
    ? or(
        ilike(schema.contactSubmissions.name, pattern),
        ilike(schema.contactSubmissions.email, pattern),
        ilike(schema.contactSubmissions.message, pattern),
        ilike(schema.contactSubmissions.attachmentName, pattern),
      )
    : undefined;

  const selectColumns = {
    id: schema.contactSubmissions.id,
    name: schema.contactSubmissions.name,
    email: schema.contactSubmissions.email,
    phone: schema.contactSubmissions.phone,
    message: schema.contactSubmissions.message,
    attachmentName: schema.contactSubmissions.attachmentName,
    attachmentMimeType: schema.contactSubmissions.attachmentMimeType,
    attachmentSizeBytes: schema.contactSubmissions.attachmentSizeBytes,
    attachmentSha256: schema.contactSubmissions.attachmentSha256,
    createdAt: schema.contactSubmissions.createdAt,
  };

  const [countRows, rows] = await Promise.all([
    searchFilter
      ? db.select({ total: count() }).from(schema.contactSubmissions).where(searchFilter)
      : db.select({ total: count() }).from(schema.contactSubmissions),
    searchFilter
      ? db
          .select(selectColumns)
          .from(schema.contactSubmissions)
          .where(searchFilter)
          .orderBy(desc(schema.contactSubmissions.createdAt))
          .limit(pageSize)
          .offset(offset)
      : db
          .select(selectColumns)
          .from(schema.contactSubmissions)
          .orderBy(desc(schema.contactSubmissions.createdAt))
          .limit(pageSize)
          .offset(offset),
  ]);

  let pinnedRow = validSelectedId ? (rows.find(row => row.id === validSelectedId) ?? null) : null;
  if (validSelectedId && !pinnedRow && !searchFilter) {
    const [fetchedSelected] = await db
      .select(selectColumns)
      .from(schema.contactSubmissions)
      .where(eq(schema.contactSubmissions.id, validSelectedId))
      .limit(1);
    pinnedRow = fetchedSelected ?? null;
  }

  const contextIds = Array.from(
    new Set([...rows.map(row => row.id), ...(pinnedRow ? [pinnedRow.id] : [])]),
  );
  const visitorContextMap = await loadInboxVisitorContextMap(db, contextIds);

  const mapRow = (row: (typeof rows)[number]): AdminInboxItem =>
    AdminInboxItemSchema.parse({
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      message: row.message,
      attachmentName: row.attachmentName,
      attachmentMimeType: row.attachmentMimeType,
      attachmentSizeBytes: row.attachmentSizeBytes,
      attachmentSha256: row.attachmentSha256,
      visitorContext: visitorContextMap.get(row.id) ?? null,
      createdAt: row.createdAt.toISOString(),
    });

  const items: AdminInboxItem[] = rows.map(mapRow);
  const selectedItem = pinnedRow ? mapRow(pinnedRow) : null;

  return AdminInboxLoaderDataSchema.parse({
    items,
    totalCount: countRows[0]?.total ?? 0,
    page,
    pageSize,
    query,
    selectedId: selectedItem?.id ?? null,
    selectedItem,
  });
}

export interface ContactSubmissionAttachmentRecord {
  id: string;
  attachmentName: string;
  attachmentMimeType: string;
  attachmentSizeBytes: number;
  attachmentSha256: string;
  attachmentContentBase64: string;
}

export async function getContactSubmissionAttachment(
  db: AppDatabase,
  id: string,
): Promise<ContactSubmissionAttachmentRecord | null> {
  if (!UUID_PATTERN.test(id)) return null;
  const [row] = await db
    .select({
      id: schema.contactSubmissions.id,
      attachmentName: schema.contactSubmissions.attachmentName,
      attachmentMimeType: schema.contactSubmissions.attachmentMimeType,
      attachmentSizeBytes: schema.contactSubmissions.attachmentSizeBytes,
      attachmentSha256: schema.contactSubmissions.attachmentSha256,
      attachmentContentBase64: schema.contactSubmissions.attachmentContentBase64,
    })
    .from(schema.contactSubmissions)
    .where(eq(schema.contactSubmissions.id, id))
    .limit(1);

  if (
    !row ||
    !row.attachmentName ||
    !row.attachmentMimeType ||
    !row.attachmentSizeBytes ||
    !row.attachmentSha256 ||
    !row.attachmentContentBase64
  ) {
    return null;
  }

  return {
    id: row.id,
    attachmentName: row.attachmentName,
    attachmentMimeType: row.attachmentMimeType,
    attachmentSizeBytes: row.attachmentSizeBytes,
    attachmentSha256: row.attachmentSha256,
    attachmentContentBase64: row.attachmentContentBase64,
  };
}

export async function deleteContactSubmission(db: AppDatabase, id: string): Promise<boolean> {
  if (!UUID_PATTERN.test(id)) return false;
  const deleted = await db
    .delete(schema.contactSubmissions)
    .where(eq(schema.contactSubmissions.id, id))
    .returning({ id: schema.contactSubmissions.id });
  return deleted.length > 0;
}

export async function deleteContactSubmissions(
  db: AppDatabase,
  ids: readonly string[],
): Promise<number> {
  const validIds = [...new Set(ids.filter(id => UUID_PATTERN.test(id)))];
  if (validIds.length === 0) return 0;
  const deleted = await db
    .delete(schema.contactSubmissions)
    .where(inArray(schema.contactSubmissions.id, validIds))
    .returning({ id: schema.contactSubmissions.id });
  return deleted.length;
}

export async function listQuotaPoliciesAndBuckets(db: AppDatabase): Promise<AdminQuotasLoaderData> {
  const [policyRows, bucketRows] = await Promise.all([
    db.select().from(schema.quotaPolicies).orderBy(asc(schema.quotaPolicies.role)),
    db
      .select()
      .from(schema.rateLimitBuckets)
      .orderBy(desc(schema.rateLimitBuckets.windowStart), asc(schema.rateLimitBuckets.scopeKey))
      .limit(200),
  ]);

  return AdminQuotasLoaderDataSchema.parse({
    policies: policyRows.map(row => QuotaPolicyRecordSchema.parse(row)),
    buckets: bucketRows.map(row =>
      RateLimitBucketRecordSchema.parse({
        scopeKey: row.scopeKey,
        windowStart: row.windowStart.toISOString(),
        turnsUsed: row.turnsUsed,
        tokensUsed: row.tokensUsed,
      }),
    ),
  });
}

export async function updateQuotaPolicy(
  db: AppDatabase,
  policy: QuotaPolicyUpdate,
): Promise<QuotaPolicyRecord> {
  const parsed = QuotaPolicyUpdateSchema.parse(policy);
  const [row] = await db
    .insert(schema.quotaPolicies)
    .values({
      role: parsed.role,
      maxTurnsPerSession: parsed.maxTurnsPerSession,
      maxTokensPerRun: parsed.maxTokensPerRun,
      maxDailyGlobalTokens: parsed.maxDailyGlobalTokens,
    })
    .onConflictDoUpdate({
      target: schema.quotaPolicies.role,
      set: {
        maxTurnsPerSession: parsed.maxTurnsPerSession,
        maxTokensPerRun: parsed.maxTokensPerRun,
        maxDailyGlobalTokens: parsed.maxDailyGlobalTokens,
      },
    })
    .returning();

  if (!row) {
    throw new Error(`Failed to update quota policy for role "${parsed.role}"`);
  }

  return QuotaPolicyRecordSchema.parse(row);
}

export async function resetRateLimitBucket(db: AppDatabase, scopeKey: string): Promise<boolean> {
  const parsed = BucketResetSchema.parse({ scopeKey });
  const updated = await db
    .update(schema.rateLimitBuckets)
    .set({
      turnsUsed: 0,
      tokensUsed: 0,
      windowStart: new Date(),
    })
    .where(eq(schema.rateLimitBuckets.scopeKey, parsed.scopeKey))
    .returning({ scopeKey: schema.rateLimitBuckets.scopeKey });
  return updated.length > 0;
}

export async function purgeStaleRateLimitBuckets(
  db: AppDatabase,
  olderThanHours = 24,
): Promise<number> {
  const parsed = BucketPurgeSchema.parse({ olderThanHours });
  const cutoff = new Date(Date.now() - parsed.olderThanHours * 60 * 60 * 1000);
  const deleted = await db
    .delete(schema.rateLimitBuckets)
    .where(lte(schema.rateLimitBuckets.windowStart, cutoff))
    .returning({ scopeKey: schema.rateLimitBuckets.scopeKey });
  return deleted.length;
}

export interface LoadAdminCmsOptions {
  readonly creatorHandle?: string;
}

export async function loadAdminCmsData(
  db: AppDatabase,
  options: LoadAdminCmsOptions = {},
): Promise<AdminCmsLoaderData> {
  const creatorHandle = options.creatorHandle?.trim() || resolveAgensiCreatorHandle();
  const [
    siteContentRows,
    menuItemRows,
    profileRows,
    commandRows,
    entryRows,
    directoryEntryRows,
    agensiSkills,
    syncStateRow,
    presetRows,
    careerDossiers,
  ] = await Promise.all([
    db.select().from(schema.siteContent).orderBy(asc(schema.siteContent.key)),
    db
      .select()
      .from(schema.menuItems)
      .orderBy(asc(schema.menuItems.sortOrder), asc(schema.menuItems.slug)),
    db.select().from(schema.terminalProfiles).orderBy(asc(schema.terminalProfiles.slug)),
    db
      .select()
      .from(schema.terminalCommands)
      .orderBy(
        asc(schema.terminalCommands.profileSlug),
        asc(schema.terminalCommands.sortOrder),
        asc(schema.terminalCommands.id),
      ),
    db
      .select()
      .from(schema.terminalInitialEntries)
      .orderBy(
        asc(schema.terminalInitialEntries.profileSlug),
        asc(schema.terminalInitialEntries.sortOrder),
        asc(schema.terminalInitialEntries.id),
      ),
    db
      .select()
      .from(schema.terminalDirectoryEntries)
      .orderBy(
        asc(schema.terminalDirectoryEntries.profileSlug),
        asc(schema.terminalDirectoryEntries.sortOrder),
        asc(schema.terminalDirectoryEntries.id),
      ),
    queryCreatorPublishedSkills(db, creatorHandle),
    readAgensiSyncState(db, creatorHandle),
    db
      .select()
      .from(schema.cadencePresets)
      .orderBy(asc(schema.cadencePresets.sortOrder), asc(schema.cadencePresets.slug)),
    listCareerDossiers(db),
  ]);

  return AdminCmsLoaderDataSchema.parse({
    siteContents: siteContentRows
      .filter(row => row.key !== RETIRED_MAINTENANCE_KEY)
      .map(row =>
        SiteContentRowSchema.parse({
          key: row.key,
          markdownBody: row.markdownBody,
          metadataJson: row.metadataJson,
          updatedAt: row.updatedAt.toISOString(),
        }),
      ),
    menuItems: menuItemRows.map(row => MenuItemSchema.parse(row)),
    terminalProfiles: profileRows
      .filter(row => row.slug !== RETIRED_MAINTENANCE_KEY)
      .map(row => AdminTerminalProfileRowSchema.parse(row)),
    terminalCommands: commandRows
      .filter(row => row.profileSlug !== RETIRED_MAINTENANCE_KEY)
      .map(row => AdminTerminalCommandRowSchema.parse(row)),
    terminalInitialEntries: entryRows
      .filter(row => row.profileSlug !== RETIRED_MAINTENANCE_KEY)
      .map(row => AdminTerminalInitialEntryRowSchema.parse(row)),
    terminalDirectoryEntries: directoryEntryRows
      .filter(row => row.profileSlug !== RETIRED_MAINTENANCE_KEY)
      .map(row => AdminTerminalDirectoryEntryRowSchema.parse(row)),
    agensiSkills,
    agensiSyncState: syncStateRow
      ? AgensiSyncStateSchema.parse({
          creatorHandle: syncStateRow.creatorHandle,
          lastSyncedAt: syncStateRow.lastSyncedAt ? syncStateRow.lastSyncedAt.toISOString() : null,
          lastAttemptAt: syncStateRow.lastAttemptAt
            ? syncStateRow.lastAttemptAt.toISOString()
            : null,
          lastStatus: syncStateRow.lastStatus,
          lastError: syncStateRow.lastError ?? null,
          itemCount: syncStateRow.itemCount,
        })
      : null,
    cadencePresets: presetRows.map(row => CadencePresetSchema.parse(row)),
    careerDossiers,
  });
}

export interface UpsertSiteContentOptions {
  readonly rawDenylist?: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly correlationId?: string;
}

export async function upsertSiteContent(
  db: AppDatabase,
  key: string,
  markdownBody: string,
  metadataJson: Record<string, unknown>,
  options: UpsertSiteContentOptions = {},
): Promise<SiteContentRow> {
  const parsed = SiteContentUpsertSchema.parse({ key, markdownBody, metadataJson });
  let validatedMetadata: Record<string, unknown>;
  if (isKnownSiteContentKey(parsed.key)) {
    const schemaResult = SITE_CONTENT_SCHEMA_BY_KEY[parsed.key].safeParse(parsed.metadataJson);
    if (!schemaResult.success) {
      if (
        parsed.key === SITE_CONTENT_KEYS.portalHome &&
        schemaResult.error.issues.some(
          issue =>
            issue.path.length === 2 && issue.path[0] === 'portrait' && issue.path[1] === 'src',
        )
      ) {
        console.warn(
          JSON.stringify({
            event: 'portal.home.portrait_src_invalid',
            seam_type: 'UNSOUND_CONDITION',
            surface: 'site_content.portal-home',
          }),
        );
      }
      throw schemaResult.error;
    }
    validatedMetadata = schemaResult.data;
  } else {
    validatedMetadata = parsed.metadataJson;
  }

  if (parsed.key === SITE_CONTENT_KEYS.portalAsk) {
    sanitizePortalAskSiteContent(
      parsed.markdownBody,
      validatedMetadata,
      options.rawDenylist,
      options.correlationId,
      options.env,
    );
  } else if (parsed.key === SITE_CONTENT_KEYS.portalHome) {
    sanitizePortalHomeSiteContent(
      parsed.markdownBody,
      validatedMetadata,
      options.rawDenylist,
      options.correlationId,
      options.env,
    );
  } else if (parsed.key === SITE_CONTENT_KEYS.portalAbout) {
    sanitizePortalAboutSiteContent(
      parsed.markdownBody,
      validatedMetadata,
      options.rawDenylist,
      options.correlationId,
      options.env,
    );
  }

  const [row] = await db
    .insert(schema.siteContent)
    .values({
      key: parsed.key,
      markdownBody: parsed.markdownBody,
      metadataJson: validatedMetadata,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: schema.siteContent.key,
      set: {
        markdownBody: parsed.markdownBody,
        metadataJson: validatedMetadata,
        updatedAt: new Date(),
      },
    })
    .returning();

  if (!row) {
    throw new Error(`Failed to upsert site_content row "${parsed.key}"`);
  }

  return SiteContentRowSchema.parse({
    key: row.key,
    markdownBody: row.markdownBody,
    metadataJson: row.metadataJson,
    updatedAt: row.updatedAt.toISOString(),
  });
}

export async function upsertMenuItem(
  db: AppDatabase,
  input: MenuItemUpsertInput,
): Promise<MenuItem> {
  const parsed = MenuItemUpsertSchema.parse(input);
  const [row] = await db
    .insert(schema.menuItems)
    .values({
      slug: parsed.slug,
      keyShortcut: parsed.keyShortcut,
      title: parsed.title,
      description: parsed.description,
      adminOnly: parsed.adminOnly,
      sortOrder: parsed.sortOrder,
      enabled: parsed.enabled,
    })
    .onConflictDoUpdate({
      target: schema.menuItems.slug,
      set: {
        keyShortcut: parsed.keyShortcut,
        title: parsed.title,
        description: parsed.description,
        adminOnly: parsed.adminOnly,
        sortOrder: parsed.sortOrder,
        enabled: parsed.enabled,
      },
    })
    .returning();

  if (!row) throw new Error(`Failed to upsert menu_items row "${parsed.slug}"`);
  return MenuItemSchema.parse(row);
}

export async function deleteMenuItem(db: AppDatabase, slug: string): Promise<boolean> {
  const deleted = await db
    .delete(schema.menuItems)
    .where(eq(schema.menuItems.slug, slug.trim()))
    .returning({ slug: schema.menuItems.slug });
  return deleted.length > 0;
}

export async function upsertTerminalProfile(
  db: AppDatabase,
  input: TerminalProfileUpsertInput,
): Promise<AdminTerminalProfileRow> {
  const parsed = TerminalProfileUpsertSchema.parse(input);
  const [row] = await db
    .insert(schema.terminalProfiles)
    .values(parsed)
    .onConflictDoUpdate({
      target: schema.terminalProfiles.slug,
      set: {
        bannerTitle: parsed.bannerTitle,
        bannerMeta: parsed.bannerMeta,
        osLabel: parsed.osLabel,
        directory: parsed.directory,
        vcsBranch: parsed.vcsBranch,
        vcsState: parsed.vcsState,
        contextLabel: parsed.contextLabel,
        placeholder: parsed.placeholder,
        quickCommands: parsed.quickCommands,
      },
    })
    .returning();

  if (!row) throw new Error(`Failed to upsert terminal_profiles row "${parsed.slug}"`);
  return AdminTerminalProfileRowSchema.parse(row);
}

export async function upsertTerminalCommand(
  db: AppDatabase,
  input: TerminalCommandUpsertInput,
): Promise<AdminTerminalCommandRow> {
  const parsed = TerminalCommandUpsertSchema.parse(input);
  if (parsed.id) {
    const [updated] = await db
      .update(schema.terminalCommands)
      .set({
        profileSlug: parsed.profileSlug,
        name: parsed.name,
        description: parsed.description,
        kind: parsed.kind,
        output: parsed.output,
        targetRoute: parsed.targetRoute || null,
        allowedRoutes: parsed.allowedRoutes,
        errorTemplate: parsed.errorTemplate || null,
        sortOrder: parsed.sortOrder,
      })
      .where(eq(schema.terminalCommands.id, parsed.id))
      .returning();
    if (updated) return AdminTerminalCommandRowSchema.parse(updated);
  }

  const [row] = await db
    .insert(schema.terminalCommands)
    .values({
      profileSlug: parsed.profileSlug,
      name: parsed.name,
      description: parsed.description,
      kind: parsed.kind,
      output: parsed.output,
      targetRoute: parsed.targetRoute || null,
      allowedRoutes: parsed.allowedRoutes,
      errorTemplate: parsed.errorTemplate || null,
      sortOrder: parsed.sortOrder,
    })
    .onConflictDoUpdate({
      target: [schema.terminalCommands.profileSlug, schema.terminalCommands.name],
      set: {
        description: parsed.description,
        kind: parsed.kind,
        output: parsed.output,
        targetRoute: parsed.targetRoute || null,
        allowedRoutes: parsed.allowedRoutes,
        errorTemplate: parsed.errorTemplate || null,
        sortOrder: parsed.sortOrder,
      },
    })
    .returning();

  if (!row) throw new Error(`Failed to upsert terminal_commands row "${parsed.name}"`);
  return AdminTerminalCommandRowSchema.parse(row);
}

export async function deleteTerminalCommand(db: AppDatabase, id: number): Promise<boolean> {
  if (!Number.isInteger(id) || id <= 0) return false;
  const deleted = await db
    .delete(schema.terminalCommands)
    .where(eq(schema.terminalCommands.id, id))
    .returning({ id: schema.terminalCommands.id });
  return deleted.length > 0;
}

export async function upsertTerminalInitialEntry(
  db: AppDatabase,
  input: TerminalInitialEntryUpsertInput,
): Promise<AdminTerminalInitialEntryRow> {
  const parsed = TerminalInitialEntryUpsertSchema.parse(input);
  if (parsed.id) {
    const [updated] = await db
      .update(schema.terminalInitialEntries)
      .set({
        profileSlug: parsed.profileSlug,
        command: parsed.command,
        output: parsed.output,
        status: parsed.status,
        durationLabel: parsed.durationLabel,
        timestampLabel: parsed.timestampLabel,
        sortOrder: parsed.sortOrder,
      })
      .where(eq(schema.terminalInitialEntries.id, parsed.id))
      .returning();
    if (updated) return AdminTerminalInitialEntryRowSchema.parse(updated);
  }

  const [row] = await db
    .insert(schema.terminalInitialEntries)
    .values({
      profileSlug: parsed.profileSlug,
      command: parsed.command,
      output: parsed.output,
      status: parsed.status,
      durationLabel: parsed.durationLabel,
      timestampLabel: parsed.timestampLabel,
      sortOrder: parsed.sortOrder,
    })
    .onConflictDoUpdate({
      target: [schema.terminalInitialEntries.profileSlug, schema.terminalInitialEntries.sortOrder],
      set: {
        command: parsed.command,
        output: parsed.output,
        status: parsed.status,
        durationLabel: parsed.durationLabel,
        timestampLabel: parsed.timestampLabel,
      },
    })
    .returning();

  if (!row) throw new Error(`Failed to upsert terminal_initial_entries row "${parsed.command}"`);
  return AdminTerminalInitialEntryRowSchema.parse(row);
}

export async function deleteTerminalInitialEntry(db: AppDatabase, id: number): Promise<boolean> {
  if (!Number.isInteger(id) || id <= 0) return false;
  const deleted = await db
    .delete(schema.terminalInitialEntries)
    .where(eq(schema.terminalInitialEntries.id, id))
    .returning({ id: schema.terminalInitialEntries.id });
  return deleted.length > 0;
}

export async function upsertTerminalDirectoryEntry(
  db: AppDatabase,
  input: TerminalDirectoryEntryUpsertInput,
): Promise<AdminTerminalDirectoryEntryRow> {
  const parsed = TerminalDirectoryEntryUpsertSchema.parse(input);
  const values = {
    profileSlug: parsed.profileSlug,
    name: parsed.name,
    description: parsed.description,
    sortOrder: parsed.sortOrder,
    enabled: parsed.enabled,
  };

  if (parsed.id) {
    const [updated] = await db
      .update(schema.terminalDirectoryEntries)
      .set(values)
      .where(eq(schema.terminalDirectoryEntries.id, parsed.id))
      .returning();
    if (updated) return AdminTerminalDirectoryEntryRowSchema.parse(updated);
  }

  const [row] = await db
    .insert(schema.terminalDirectoryEntries)
    .values(values)
    .onConflictDoUpdate({
      target: [schema.terminalDirectoryEntries.profileSlug, schema.terminalDirectoryEntries.name],
      set: {
        description: parsed.description,
        sortOrder: parsed.sortOrder,
        enabled: parsed.enabled,
      },
    })
    .returning();

  if (!row) throw new Error(`Failed to upsert terminal_directory_entries row "${parsed.name}"`);
  return AdminTerminalDirectoryEntryRowSchema.parse(row);
}

export async function deleteTerminalDirectoryEntry(db: AppDatabase, id: number): Promise<boolean> {
  if (!Number.isInteger(id) || id <= 0) return false;
  const deleted = await db
    .delete(schema.terminalDirectoryEntries)
    .where(eq(schema.terminalDirectoryEntries.id, id))
    .returning({ id: schema.terminalDirectoryEntries.id });
  return deleted.length > 0;
}

/**
 * @deprecated Admin CMS manual Agensi CRUD has been retired in favor of `syncAgensiCatalog`;
 * retained for one release cycle compatibility before removal.
 */
export async function upsertAgensiSkill(
  db: AppDatabase,
  input: AgensiSkillUpsertInput,
): Promise<AgensiSkill> {
  const parsed = AgensiSkillUpsertSchema.parse(input);
  const [row] = await db
    .insert(schema.agensiSkills)
    .values(parsed)
    .onConflictDoUpdate({
      target: schema.agensiSkills.slug,
      set: {
        name: parsed.name,
        summary: parsed.summary,
        tags: parsed.tags,
        url: parsed.url,
        sortOrder: parsed.sortOrder,
      },
    })
    .returning();

  if (!row) throw new Error(`Failed to upsert agensi_skills row "${parsed.slug}"`);
  return AgensiSkillSchema.parse({
    ...row,
    creatorHandle: row.creatorHandle ?? null,
    isPublished: row.isPublished,
    syncedAt: row.syncedAt ? row.syncedAt.toISOString() : null,
    source: row.source,
  });
}

/**
 * @deprecated Admin CMS manual Agensi CRUD has been retired in favor of `syncAgensiCatalog`;
 * retained for one release cycle compatibility before removal.
 */
export async function deleteAgensiSkill(db: AppDatabase, slug: string): Promise<boolean> {
  const deleted = await db
    .delete(schema.agensiSkills)
    .where(eq(schema.agensiSkills.slug, slug.trim()))
    .returning({ slug: schema.agensiSkills.slug });
  return deleted.length > 0;
}

export async function upsertCadencePreset(
  db: AppDatabase,
  input: CadencePresetUpsertInput,
): Promise<CadencePreset> {
  const parsed = CadencePresetUpsertSchema.parse(input);
  const [row] = await db
    .insert(schema.cadencePresets)
    .values(parsed)
    .onConflictDoUpdate({
      target: schema.cadencePresets.slug,
      set: {
        title: parsed.title,
        starterPrompt: parsed.starterPrompt,
        expectedKind: parsed.expectedKind,
        starterArtifactHtml: parsed.starterArtifactHtml,
        sortOrder: parsed.sortOrder,
      },
    })
    .returning();

  if (!row) throw new Error(`Failed to upsert cadence_presets row "${parsed.slug}"`);
  return CadencePresetSchema.parse(row);
}

export async function deleteCadencePreset(db: AppDatabase, slug: string): Promise<boolean> {
  const deleted = await db
    .delete(schema.cadencePresets)
    .where(eq(schema.cadencePresets.slug, slug.trim()))
    .returning({ slug: schema.cadencePresets.slug });
  return deleted.length > 0;
}

export async function listAdminSandboxRuns(
  db: AppDatabase,
  limit = 25,
): Promise<AdminSandboxRun[]> {
  const clampedLimit = Math.max(1, Math.min(100, Math.floor(limit)));
  const runs = await db
    .select()
    .from(schema.sandboxRuns)
    .where(eq(schema.sandboxRuns.isGolden, false))
    .orderBy(desc(schema.sandboxRuns.createdAt))
    .limit(clampedLimit);

  if (runs.length === 0) return [];

  const runIds = runs.map(run => run.id);
  const allTurnRows = await db
    .select()
    .from(schema.sandboxTurns)
    .where(inArray(schema.sandboxTurns.runId, runIds))
    .orderBy(asc(schema.sandboxTurns.id));

  const turnsByRun = new Map<string, CadenceTurn[]>();
  for (const row of allTurnRows) {
    const existing = turnsByRun.get(row.runId) ?? [];
    existing.push(mapSandboxTurnRow(row));
    turnsByRun.set(row.runId, existing);
  }

  return runs.map(run =>
    AdminSandboxRunSchema.parse({
      runId: run.id,
      sessionId: run.sessionId,
      menuSlug: run.menuSlug,
      runStatus: run.status,
      prompt: run.prompt,
      gateVerdict: normalizeGateVerdict(run.gateVerdict),
      turns: turnsByRun.get(run.id) ?? [],
      artifactHtml: run.artifactHtml ?? '',
      tokensIn: run.tokensIn,
      tokensOut: run.tokensOut,
      createdAt: run.createdAt.toISOString(),
    }),
  );
}

export async function overrideSandboxGateVerdict(
  db: AppDatabase,
  runId: string,
  gateVerdict: CadenceGateVerdict,
): Promise<AdminSandboxRun | null> {
  const verdict = CadenceGateVerdictSchema.parse(gateVerdict);
  const result = await updateSandboxRunGateVerdictRow(db, runId, verdict);
  if (!result) return null;

  return AdminSandboxRunSchema.parse({
    runId: result.run.id,
    sessionId: result.run.sessionId,
    menuSlug: result.run.menuSlug,
    runStatus: result.run.status,
    prompt: result.run.prompt,
    gateVerdict: verdict,
    turns: result.turns,
    artifactHtml: result.run.artifactHtml ?? '',
    tokensIn: result.run.tokensIn,
    tokensOut: result.run.tokensOut,
    createdAt: result.run.createdAt.toISOString(),
  });
}
