import { z } from 'zod';

import { RoleSchema } from './auth.ts';
import {
  AdminHomeContentSchema,
  AgensiSkillSchema,
  CadenceGateVerdictSchema,
  CadencePresetSchema,
  CadenceRunResultSchema,
  MenuItemSchema,
  RoadmapMilestoneSchema,
  RoadmapMilestoneStatusSchema,
} from './portal.ts';
import {
  TerminalCommandKindSchema,
  TerminalDirectoryEntrySchema,
  TerminalEntryStatusSchema,
  TerminalVcsStateSchema,
} from './terminal.ts';

export const AdminServiceHealthStatusSchema = z.enum(['ok', 'degraded', 'offline']);
export type AdminServiceHealthStatus = z.infer<typeof AdminServiceHealthStatusSchema>;

export const AdminServiceHealthSchema = z.object({
  name: z.string().min(1),
  status: AdminServiceHealthStatusSchema,
  detail: z.string(),
});
export type AdminServiceHealth = z.infer<typeof AdminServiceHealthSchema>;

export const AdminOverviewMetricsSchema = z.object({
  contactCount: z.number().int().nonnegative(),
  sessions24h: z.number().int().nonnegative(),
  events24h: z.number().int().nonnegative(),
  dailyTokensUsed: z.number().int().nonnegative(),
  dailyTokenCap: z.number().int().positive(),
  totalSandboxRuns: z.number().int().nonnegative(),
  pendingGates: z.number().int().nonnegative(),
});
export type AdminOverviewMetrics = z.infer<typeof AdminOverviewMetricsSchema>;

export const AdminSecuritySummarySchema = z.object({
  handle: z.string().min(1),
  passkeyCount: z.number().int().nonnegative(),
  totpEnabled: z.boolean(),
});
export type AdminSecuritySummary = z.infer<typeof AdminSecuritySummarySchema>;

export const AdminOverviewLoaderDataSchema = z.object({
  content: AdminHomeContentSchema,
  menuItems: z.array(MenuItemSchema),
  health: z.object({
    postgres: AdminServiceHealthSchema,
    qdrant: AdminServiceHealthSchema,
    portfolioPublic: AdminServiceHealthSchema,
    cadenceAdmin: AdminServiceHealthSchema,
  }),
  metrics: AdminOverviewMetricsSchema,
  maintenanceModeDefault: z.boolean(),
  rebuildProgressPercent: z.number().int().min(0).max(100),
  security: AdminSecuritySummarySchema,
});
export type AdminOverviewLoaderData = z.infer<typeof AdminOverviewLoaderDataSchema>;

export const AdminInboxItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  email: z.string().min(1),
  phone: z.string().nullable(),
  message: z.string().min(1),
  attachmentName: z.string().nullable(),
  attachmentMimeType: z.string().nullable(),
  attachmentSizeBytes: z.number().int().positive().nullable(),
  attachmentSha256: z.string().nullable(),
  createdAt: z.iso.datetime(),
});
export type AdminInboxItem = z.infer<typeof AdminInboxItemSchema>;

export const AdminInboxLoaderDataSchema = z.object({
  items: z.array(AdminInboxItemSchema),
  totalCount: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  query: z.string(),
});
export type AdminInboxLoaderData = z.infer<typeof AdminInboxLoaderDataSchema>;

export const QuotaPolicyRecordSchema = z.object({
  role: RoleSchema,
  maxTurnsPerSession: z.number().int().positive(),
  maxTokensPerRun: z.number().int().positive(),
  maxDailyGlobalTokens: z.number().int().positive(),
});
export type QuotaPolicyRecord = z.infer<typeof QuotaPolicyRecordSchema>;

export const RateLimitBucketRecordSchema = z.object({
  scopeKey: z.string().min(1),
  windowStart: z.iso.datetime(),
  turnsUsed: z.number().int().nonnegative(),
  tokensUsed: z.number().int().nonnegative(),
});
export type RateLimitBucketRecord = z.infer<typeof RateLimitBucketRecordSchema>;

export const AdminQuotasLoaderDataSchema = z.object({
  policies: z.array(QuotaPolicyRecordSchema),
  buckets: z.array(RateLimitBucketRecordSchema),
});
export type AdminQuotasLoaderData = z.infer<typeof AdminQuotasLoaderDataSchema>;

export const QuotaPolicyUpdateSchema = z.object({
  role: RoleSchema,
  maxTurnsPerSession: z.coerce.number().int().min(1).max(10_000),
  maxTokensPerRun: z.coerce.number().int().min(100).max(1_000_000),
  maxDailyGlobalTokens: z.coerce.number().int().min(1_000).max(100_000_000),
});
export type QuotaPolicyUpdate = z.infer<typeof QuotaPolicyUpdateSchema>;

export const BucketResetSchema = z.object({
  scopeKey: z.string().trim().min(1).max(256),
});
export type BucketResetInput = z.infer<typeof BucketResetSchema>;

export const BucketPurgeSchema = z.object({
  olderThanHours: z.coerce.number().int().min(0).max(8760).default(24),
});
export type BucketPurgeInput = z.infer<typeof BucketPurgeSchema>;

export const SiteContentRowSchema = z.object({
  key: z.string().min(1),
  markdownBody: z.string(),
  metadataJson: z.record(z.string(), z.unknown()),
  updatedAt: z.iso.datetime(),
});
export type SiteContentRow = z.infer<typeof SiteContentRowSchema>;

export const AdminTerminalProfileRowSchema = z.object({
  slug: z.string().min(1),
  bannerTitle: z.string().min(1),
  bannerMeta: z.string().min(1),
  osLabel: z.string().min(1),
  directory: z.string().min(1),
  vcsBranch: z.string().min(1),
  vcsState: TerminalVcsStateSchema,
  contextLabel: z.string().min(1),
  placeholder: z.string().min(1),
  quickCommands: z.array(z.string()),
});
export type AdminTerminalProfileRow = z.infer<typeof AdminTerminalProfileRowSchema>;

export const AdminTerminalCommandRowSchema = z.object({
  id: z.number().int().positive(),
  profileSlug: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  kind: TerminalCommandKindSchema,
  output: z.string(),
  targetRoute: z.string().nullable(),
  allowedRoutes: z.array(z.string()),
  errorTemplate: z.string().nullable(),
  sortOrder: z.number().int().nonnegative(),
});
export type AdminTerminalCommandRow = z.infer<typeof AdminTerminalCommandRowSchema>;

export const AdminTerminalInitialEntryRowSchema = z.object({
  id: z.number().int().positive(),
  profileSlug: z.string().min(1),
  command: z.string().min(1),
  output: z.string(),
  status: TerminalEntryStatusSchema,
  durationLabel: z.string().min(1),
  timestampLabel: z.string().min(1),
  sortOrder: z.number().int().nonnegative(),
});
export type AdminTerminalInitialEntryRow = z.infer<typeof AdminTerminalInitialEntryRowSchema>;

export const AdminTerminalDirectoryEntryRowSchema = TerminalDirectoryEntrySchema.extend({
  id: z.number().int().positive(),
  profileSlug: z.string().min(1),
});
export type AdminTerminalDirectoryEntryRow = z.infer<typeof AdminTerminalDirectoryEntryRowSchema>;

export const AdminCmsLoaderDataSchema = z.object({
  siteContents: z.array(SiteContentRowSchema),
  maintenanceModeDefault: z.boolean(),
  rebuildProgressPercent: z.number().int().min(0).max(100),
  menuItems: z.array(MenuItemSchema),
  terminalProfiles: z.array(AdminTerminalProfileRowSchema),
  terminalCommands: z.array(AdminTerminalCommandRowSchema),
  terminalInitialEntries: z.array(AdminTerminalInitialEntryRowSchema),
  terminalDirectoryEntries: z.array(AdminTerminalDirectoryEntryRowSchema).default([]),
  roadmapMilestones: z.array(RoadmapMilestoneSchema),
  agensiSkills: z.array(AgensiSkillSchema),
  cadencePresets: z.array(CadencePresetSchema),
});
export type AdminCmsLoaderData = z.infer<typeof AdminCmsLoaderDataSchema>;

export const SiteContentUpsertSchema = z.object({
  key: z.string().trim().min(1).max(120),
  markdownBody: z.string(),
  metadataJson: z.record(z.string(), z.unknown()),
});
export type SiteContentUpsertInput = z.infer<typeof SiteContentUpsertSchema>;

export const MaintenanceModeUpdateSchema = z.object({
  enabled: z.boolean(),
  rebuildProgressPercent: z.coerce.number().int().min(0).max(100).optional(),
});
export type MaintenanceModeUpdateInput = z.infer<typeof MaintenanceModeUpdateSchema>;

export const MenuItemUpsertSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9-]+$/),
  keyShortcut: z.string().trim().min(1).max(4),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(400),
  targetK8sDeploy: z.string().trim().max(120).nullable(),
  namespace: z.string().trim().max(120).nullable(),
  adminOnly: z.boolean(),
  sortOrder: z.coerce.number().int().min(0).max(1000),
  enabled: z.boolean(),
});
export type MenuItemUpsertInput = z.infer<typeof MenuItemUpsertSchema>;

export const TerminalProfileUpsertSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9-]+$/),
  bannerTitle: z.string().trim().min(1).max(160),
  bannerMeta: z.string().trim().min(1).max(200),
  osLabel: z.string().trim().min(1).max(16),
  directory: z.string().trim().min(1).max(160),
  vcsBranch: z.string().trim().min(1).max(80),
  vcsState: TerminalVcsStateSchema,
  contextLabel: z.string().trim().min(1).max(120),
  placeholder: z.string().trim().min(1).max(240),
  quickCommands: z.array(z.string().trim().min(1)).default([]),
});
export type TerminalProfileUpsertInput = z.infer<typeof TerminalProfileUpsertSchema>;

export const TerminalCommandUpsertSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  profileSlug: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(64),
  description: z.string().trim().max(240).default(''),
  kind: TerminalCommandKindSchema,
  output: z.string().default(''),
  targetRoute: z.string().trim().max(160).nullable(),
  allowedRoutes: z.array(z.string().trim().min(1)).default([]),
  errorTemplate: z.string().trim().max(240).nullable(),
  sortOrder: z.coerce.number().int().min(0).max(1000),
});
export type TerminalCommandUpsertInput = z.infer<typeof TerminalCommandUpsertSchema>;

export const TerminalInitialEntryUpsertSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  profileSlug: z.string().trim().min(1).max(64),
  command: z.string().trim().min(1).max(160),
  output: z.string(),
  status: TerminalEntryStatusSchema,
  durationLabel: z.string().trim().min(1).max(32),
  timestampLabel: z.string().trim().min(1).max(32),
  sortOrder: z.coerce.number().int().min(0).max(1000),
});
export type TerminalInitialEntryUpsertInput = z.infer<typeof TerminalInitialEntryUpsertSchema>;

export const TerminalDirectoryEntryUpsertSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  profileSlug: z.string().trim().min(1).max(64),
  name: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9._-]+$/),
  description: z.string().trim().min(1).max(240),
  sortOrder: z.coerce.number().int().min(0).max(1000),
  enabled: z.boolean().default(true),
});
export type TerminalDirectoryEntryUpsertInput = z.infer<typeof TerminalDirectoryEntryUpsertSchema>;

export const RoadmapMilestoneUpsertSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9-]+$/),
  status: RoadmapMilestoneStatusSchema,
  label: z.string().trim().min(1).max(240),
  sortOrder: z.coerce.number().int().min(0).max(1000),
  enabled: z.boolean(),
});
export type RoadmapMilestoneUpsertInput = z.infer<typeof RoadmapMilestoneUpsertSchema>;

export const AgensiSkillUpsertSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9-]+$/),
  name: z.string().trim().min(1).max(120),
  summary: z.string().trim().min(1).max(600),
  tags: z.array(z.string().trim().min(1)).default([]),
  url: z.url(),
  sortOrder: z.coerce.number().int().min(0).max(1000),
});
export type AgensiSkillUpsertInput = z.infer<typeof AgensiSkillUpsertSchema>;

export const CadencePresetUpsertSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9-]+$/),
  title: z.string().trim().min(1).max(160),
  starterPrompt: z.string().trim().min(1).max(2000),
  expectedKind: z.string().trim().min(1).max(64),
  starterArtifactHtml: z.string().trim().min(1).max(50_000),
  sortOrder: z.coerce.number().int().min(0).max(1000),
});
export type CadencePresetUpsertInput = z.infer<typeof CadencePresetUpsertSchema>;

export const CadenceAdminStatusSchema = z.object({
  online: z.boolean(),
  namespace: z.string().min(1),
  isolated: z.boolean(),
  mode: z.string().min(1),
  databaseConnected: z.boolean(),
  totalSandboxRuns: z.number().int().nonnegative(),
  pendingGates: z.number().int().nonnegative(),
  timestamp: z.string(),
  detail: z.string().optional(),
});
export type CadenceAdminStatus = z.infer<typeof CadenceAdminStatusSchema>;

export const QdrantHealthStatusSchema = z.object({
  online: z.boolean(),
  collection: z.string().min(1),
  status: z.string().min(1),
  pointsCount: z.number().int().nonnegative(),
  provider: z.string().min(1),
  detail: z.string().optional(),
});
export type QdrantHealthStatus = z.infer<typeof QdrantHealthStatusSchema>;

export const AdminSandboxRunSchema = CadenceRunResultSchema.extend({
  sessionId: z.string().min(1),
  menuSlug: z.string().min(1),
  runStatus: z.string().min(1),
});
export type AdminSandboxRun = z.infer<typeof AdminSandboxRunSchema>;

export const AdminOpsLoaderDataSchema = z.object({
  cadenceAdminStatus: CadenceAdminStatusSchema,
  qdrantStatus: QdrantHealthStatusSchema,
  sandboxRuns: z.array(AdminSandboxRunSchema),
  k8sWatchConfigured: z.boolean(),
});
export type AdminOpsLoaderData = z.infer<typeof AdminOpsLoaderDataSchema>;

export const AdminGateOverrideSchema = z.object({
  runId: z.uuid(),
  gateVerdict: CadenceGateVerdictSchema,
});
export type AdminGateOverrideInput = z.infer<typeof AdminGateOverrideSchema>;

export const AdminWakeDeploymentSchema = z.object({
  deployment: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9-]+$/),
});
export type AdminWakeDeploymentInput = z.infer<typeof AdminWakeDeploymentSchema>;
