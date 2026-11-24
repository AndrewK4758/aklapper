import { z } from 'zod';

import { type FormDefinition, FormDefinitionSchema } from './forms.ts';

export * from './forms.ts';

export const RoleSchema = z.enum(['guest', 'admin']);
export type Role = z.infer<typeof RoleSchema>;

export const AuthSessionSchema = z.object({
  sessionId: z.string().min(1),
  role: RoleSchema,
  handle: z.string().min(1),
  expiresAt: z.iso.datetime(),
});
export type AuthSession = z.infer<typeof AuthSessionSchema>;

export const AuthSessionStatusSchema = z.object({
  authenticated: z.boolean(),
  session: AuthSessionSchema.nullable(),
  totpEnabled: z.boolean(),
  passkeyCount: z.number().int().nonnegative(),
});
export type AuthSessionStatus = z.infer<typeof AuthSessionStatusSchema>;

export const MenuItemSchema = z.object({
  slug: z.string().min(1),
  keyShortcut: z.string().min(1).max(4),
  title: z.string().min(1),
  description: z.string(),
  targetK8sDeploy: z.string().nullable(),
  namespace: z.string().nullable(),
  adminOnly: z.boolean(),
  sortOrder: z.number().int().nonnegative(),
  enabled: z.boolean(),
});
export type MenuItem = z.infer<typeof MenuItemSchema>;

export const Osc7501StateSchema = z.enum(['idle', 'scaling', 'running', 'gate', 'ready', 'error']);
export type Osc7501State = z.infer<typeof Osc7501StateSchema>;

export const Osc7501StatusSchema = z.object({
  source: z.string().min(1),
  state: Osc7501StateSchema,
  label: z.string().min(1),
  progress: z.number().min(0).max(100).optional(),
  timestamp: z.iso.datetime(),
});
export type Osc7501Status = z.infer<typeof Osc7501StatusSchema>;

export const K8sPodEventSchema = z.object({
  eventId: z.string().min(1),
  namespace: z.string().min(1),
  deployment: z.string().min(1),
  podName: z.string().min(1),
  phase: z.enum([
    'ScaledZero',
    'TriggeredScaleUp',
    'Pending',
    'ContainerCreating',
    'Running',
    'Terminating',
  ]),
  ready: z.boolean(),
  message: z.string(),
  timestamp: z.iso.datetime(),
});
export type K8sPodEvent = z.infer<typeof K8sPodEventSchema>;

export const QuotaStatusSchema = z.object({
  role: RoleSchema,
  turnsUsed: z.number().int().nonnegative(),
  maxTurns: z.number().int().positive(),
  tokensUsed: z.number().int().nonnegative(),
  maxTokens: z.number().int().positive(),
});
export type QuotaStatus = z.infer<typeof QuotaStatusSchema>;

export const CadenceRunRequestSchema = z.object({
  prompt: z.string().trim().min(4).max(1200),
  presetSlug: z.string().min(1).optional(),
  sessionId: z.string().min(1).optional(),
});
export type CadenceRunRequest = z.infer<typeof CadenceRunRequestSchema>;

export const CadenceGateVerdictSchema = z.enum(['pending', 'approved', 'rejected']);
export type CadenceGateVerdict = z.infer<typeof CadenceGateVerdictSchema>;

export const CadenceTurnPhaseSchema = z.enum(['triage', 'spec', 'build', 'gate']);
export type CadenceTurnPhase = z.infer<typeof CadenceTurnPhaseSchema>;

export const CadenceTurnStatusSchema = z.enum(['pending', 'running', 'completed', 'failed']);
export type CadenceTurnStatus = z.infer<typeof CadenceTurnStatusSchema>;

export const CadenceTurnSchema = z.object({
  id: z.number().int().positive().optional(),
  phase: CadenceTurnPhaseSchema,
  agentName: z.string().min(1),
  status: CadenceTurnStatusSchema,
  summary: z.string(),
  latencyMs: z.number().int().nonnegative(),
  createdAt: z.string().optional(),
});
export type CadenceTurn = z.infer<typeof CadenceTurnSchema>;

export const CadenceRunResultSchema = z.object({
  runId: z.string().min(1),
  prompt: z.string().min(1),
  presetSlug: z.string().optional(),
  status: Osc7501StatusSchema.optional(),
  osc7501: z.string().optional(),
  gateVerdict: CadenceGateVerdictSchema,
  turns: z.array(CadenceTurnSchema),
  artifactHtml: z.string(),
  tokensIn: z.number().int().nonnegative().optional(),
  tokensOut: z.number().int().nonnegative().optional(),
  quota: QuotaStatusSchema.optional(),
  createdAt: z.string().optional(),
});
export type CadenceRunResult = z.infer<typeof CadenceRunResultSchema>;

export const AskModeSchema = z.enum(['qa', 'jd_match']);
export type AskMode = z.infer<typeof AskModeSchema>;

export const AskPortfolioRequestSchema = z.object({
  mode: z.literal('qa').default('qa'),
  question: z.string().trim().min(4).max(800),
  sessionId: z.string().min(1).optional(),
});
export type AskPortfolioRequest = z.infer<typeof AskPortfolioRequestSchema>;

export const JdMatchRequestSchema = z.object({
  mode: z.literal('jd_match'),
  jobDescription: z.string().trim().min(20).max(6000),
  question: z.string().trim().max(800).optional(),
  sessionId: z.string().min(1).optional(),
});
export type JdMatchRequest = z.infer<typeof JdMatchRequestSchema>;

export const AskSourceSchema = z.object({
  id: z.string().min(1).optional(),
  title: z.string().min(1),
  snippet: z.string(),
  score: z.number().min(0).max(1),
  category: z.string().min(1).optional(),
});
export type AskSource = z.infer<typeof AskSourceSchema>;

export const AskResponseSchema = z.object({
  grounded: z.boolean(),
  mode: AskModeSchema,
  answer: z.string(),
  sources: z.array(AskSourceSchema),
  matchScore: z.number().min(0).max(100).optional(),
  strengths: z.array(z.string()).optional(),
  gaps: z.array(z.string()).optional(),
  provider: z.string().min(1),
  model: z.string().min(1).optional(),
  tokensUsed: z.number().int().nonnegative(),
  quota: QuotaStatusSchema.optional(),
});
export type AskResponse = z.infer<typeof AskResponseSchema>;

export const AnalyticsEventSchema = z.object({
  type: z.enum(['page_view', 'interaction', 'web_vital', 'error']),
  name: z.string().min(1).max(120),
  path: z.string().min(1).max(512),
  value: z.number().optional(),
  metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
  timestamp: z.iso.datetime(),
});
export type AnalyticsEvent = z.infer<typeof AnalyticsEventSchema>;

export const AnalyticsBatchSchema = z.object({
  sessionId: z.string().min(1),
  referrer: z.string().max(1024).optional(),
  events: z.array(AnalyticsEventSchema).min(1).max(50),
});
export type AnalyticsBatch = z.infer<typeof AnalyticsBatchSchema>;

export const TerminalVcsStateSchema = z.enum(['clean', 'modified', 'untracked']);
export type TerminalVcsState = z.infer<typeof TerminalVcsStateSchema>;

export const TerminalEntryStatusSchema = z.enum(['ok', 'error']);
export type TerminalEntryStatus = z.infer<typeof TerminalEntryStatusSchema>;

export const TerminalInitialEntrySchema = z.object({
  command: z.string().min(1),
  output: z.string(),
  status: TerminalEntryStatusSchema,
  durationLabel: z.string().min(1),
  timestamp: z.string().min(1),
  sortOrder: z.number().int().nonnegative(),
});
export type TerminalInitialEntry = z.infer<typeof TerminalInitialEntrySchema>;

export const TerminalCommandKindSchema = z.enum([
  'static',
  'navigate',
  'cd',
  'tui',
  'roadmap',
  'uptime',
  'clear',
]);
export type TerminalCommandKind = z.infer<typeof TerminalCommandKindSchema>;

export const TerminalCommandSpecSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  kind: TerminalCommandKindSchema,
  output: z.string(),
  targetRoute: z.string().nullable(),
  allowedRoutes: z.array(z.string()),
  errorTemplate: z.string().nullable(),
  sortOrder: z.number().int().nonnegative(),
});
export type TerminalCommandSpec = z.infer<typeof TerminalCommandSpecSchema>;

export const TerminalProfileDataSchema = z.object({
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
  initialEntries: z.array(TerminalInitialEntrySchema),
  commands: z.array(TerminalCommandSpecSchema),
});
export type TerminalProfileData = z.infer<typeof TerminalProfileDataSchema>;

export const RoadmapMilestoneStatusSchema = z.enum(['done', 'active', 'queued']);
export type RoadmapMilestoneStatus = z.infer<typeof RoadmapMilestoneStatusSchema>;

export const RoadmapMilestoneSchema = z.object({
  slug: z.string().min(1),
  status: RoadmapMilestoneStatusSchema,
  label: z.string().min(1),
  sortOrder: z.number().int().nonnegative(),
  enabled: z.boolean(),
});
export type RoadmapMilestone = z.infer<typeof RoadmapMilestoneSchema>;

export const StatusBadgeSpecSchema = z.object({
  source: z.string().min(1),
  state: Osc7501StateSchema,
  label: z.string().min(1),
});
export type StatusBadgeSpec = z.infer<typeof StatusBadgeSpecSchema>;

export const LinkActionSpecSchema = z.object({
  label: z.string().min(1),
  to: z.string().min(1),
  variant: z.enum(['default', 'primary']),
});
export type LinkActionSpec = z.infer<typeof LinkActionSpecSchema>;

export const PortalChromeContentSchema = z.object({
  pageTitle: z.string().min(1),
  brandLabel: z.string().min(1),
  statusBadge: StatusBadgeSpecSchema,
  footerText: z.string().min(1),
  footerLinkLabel: z.string().min(1),
  footerLinkUrl: z.url(),
  maintenanceModeDefault: z.boolean(),
});
export type PortalChromeContent = z.infer<typeof PortalChromeContentSchema>;

export const PortalHomeContentSchema = z.object({
  tuiTitle: z.string().min(1),
  tuiBadge: StatusBadgeSpecSchema,
  heading: z.string().min(1),
  description: z.string().min(1),
  actions: z.array(LinkActionSpecSchema).min(1),
});
export type PortalHomeContent = z.infer<typeof PortalHomeContentSchema>;

export const PortalMenuContentSchema = z.object({
  heading: z.string().min(1),
  description: z.string().min(1),
  localTargetLabel: z.string().min(1),
});
export type PortalMenuContent = z.infer<typeof PortalMenuContentSchema>;

export const CadencePresetSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  starterPrompt: z.string().min(1),
  expectedKind: z.string().min(1),
  starterArtifactHtml: z.string().min(1),
  sortOrder: z.number().int().nonnegative(),
});
export type CadencePreset = z.infer<typeof CadencePresetSchema>;

export const PortalCadenceContentSchema = z.object({
  windowTitle: z.string().min(1),
  statusBadge: StatusBadgeSpecSchema,
  description: z.string().min(1),
  iframeTitle: z.string().min(1),
});
export type PortalCadenceContent = z.infer<typeof PortalCadenceContentSchema>;

export const PortalContactContentSchema = z.object({
  windowTitle: z.string().min(1),
  statusBadge: StatusBadgeSpecSchema,
  description: z.string().min(1),
  form: FormDefinitionSchema,
});
export type PortalContactContent = z.infer<typeof PortalContactContentSchema>;

export const PortalMaintenanceContentSchema = z.object({
  windowTitle: z.string().min(1),
  statusBadge: StatusBadgeSpecSchema,
  heading: z.string().min(1),
  lead: z.string().min(1),
  progressPercent: z.number().int().min(0).max(100),
  progressAriaLabel: z.string().min(1),
  metaLeft: z.string().min(1),
  metaRight: z.string().min(1),
});
export type PortalMaintenanceContent = z.infer<typeof PortalMaintenanceContentSchema>;

export const AdminChromeContentSchema = z.object({
  pageTitle: z.string().min(1),
  brandLabel: z.string().min(1),
  statusBadge: StatusBadgeSpecSchema,
});
export type AdminChromeContent = z.infer<typeof AdminChromeContentSchema>;

export const AdminHomeContentSchema = z.object({
  heading: z.string().min(1),
  description: z.string().min(1),
  actions: z.array(LinkActionSpecSchema).min(1),
});
export type AdminHomeContent = z.infer<typeof AdminHomeContentSchema>;

export const AdminAnalyticsContentSchema = z.object({
  windowTitle: z.string().min(1),
  description: z.string().min(1),
});
export type AdminAnalyticsContent = z.infer<typeof AdminAnalyticsContentSchema>;

export const AgensiSkillSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  summary: z.string().min(1),
  tags: z.array(z.string()),
  url: z.url(),
  sortOrder: z.number().int().nonnegative(),
});
export type AgensiSkill = z.infer<typeof AgensiSkillSchema>;

export const PortalAgensiContentSchema = z.object({
  windowTitle: z.string().min(1),
  statusBadge: StatusBadgeSpecSchema,
  description: z.string().min(1),
  searchPlaceholder: z.string().min(1),
  emptyStateLabel: z.string().min(1),
  outboundCtaLabel: z.string().min(1),
});
export type PortalAgensiContent = z.infer<typeof PortalAgensiContentSchema>;

export const PortalAskContentSchema = z.object({
  windowTitle: z.string().min(1),
  statusBadge: StatusBadgeSpecSchema,
  description: z.string().min(1),
  starterQuestions: z.array(z.string().min(1)).min(1),
  jdPlaceholder: z.string().min(1),
  abstentionNotice: z.string().min(1),
});
export type PortalAskContent = z.infer<typeof PortalAskContentSchema>;

export const DocumentSeoRuntimeConfigSchema = z.object({
  siteUrl: z.url(),
  analyticsEndpoint: z.string().min(1).optional(),
  gaMeasurementId: z.string().min(1).optional(),
  gtmId: z.string().min(1).optional(),
  gscVerification: z.string().min(1).optional(),
});
export type DocumentSeoRuntimeConfig = z.infer<typeof DocumentSeoRuntimeConfigSchema>;

export interface PortalMaintenanceLoaderData {
  content: PortalMaintenanceContent;
  terminal: TerminalProfileData;
  milestones: readonly RoadmapMilestone[];
}

export interface PortalRootLoaderData {
  maintenanceMode: boolean;
  chrome: PortalChromeContent;
  maintenance: PortalMaintenanceLoaderData | null;
  terminal?: TerminalProfileData;
  homeContent?: PortalHomeContent;
  contactForm?: FormDefinition;
  runtimeSeo?: DocumentSeoRuntimeConfig;
}

export interface PortalHomeLoaderData {
  content: PortalHomeContent;
  terminal: TerminalProfileData;
  contactForm: FormDefinition;
}

export interface PortalMenuLoaderData {
  content: PortalMenuContent;
  items: readonly MenuItem[];
}

export interface PortalAgensiLoaderData {
  content: PortalAgensiContent;
  skills: readonly AgensiSkill[];
}

export interface PortalAskLoaderData {
  content: PortalAskContent;
  quota: QuotaStatus;
}

export interface PortalCadenceLoaderData {
  content: PortalCadenceContent;
  presets: readonly CadencePreset[];
  quota?: QuotaStatus;
  recentRuns?: readonly CadenceRunResult[];
}

export interface PortalContactLoaderData {
  content: PortalContactContent;
}

export interface AdminRootLoaderData {
  chrome: AdminChromeContent;
  terminal?: TerminalProfileData;
  session?: AuthSession | null;
  authMeta?: {
    totpEnabled: boolean;
    passkeyCount: number;
  };
  runtimeSeo?: DocumentSeoRuntimeConfig;
}

export interface AdminHomeLoaderData {
  content: AdminHomeContent;
  menuItems: readonly MenuItem[];
}

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

export const AdminAnalyticsWindowSchema = z.enum(['24h', '7d', '30d', 'all']);
export type AdminAnalyticsWindow = z.infer<typeof AdminAnalyticsWindowSchema>;

export const CwvMetricNameSchema = z.enum(['LCP', 'INP', 'CLS', 'TTFB']);
export type CwvMetricName = z.infer<typeof CwvMetricNameSchema>;

export const CwvPercentileRowSchema = z.object({
  metric: CwvMetricNameSchema,
  sampleCount: z.number().int().nonnegative(),
  p50: z.number().nullable(),
  p75: z.number().nullable(),
  p95: z.number().nullable(),
});
export type CwvPercentileRow = z.infer<typeof CwvPercentileRowSchema>;

export const AnalyticsBreakdownRowSchema = z.object({
  label: z.string().min(1),
  count: z.number().int().nonnegative(),
  secondaryLabel: z.string().optional(),
});
export type AnalyticsBreakdownRow = z.infer<typeof AnalyticsBreakdownRowSchema>;

export const AgensiConversionRowSchema = z.object({
  slug: z.string().min(1),
  clicks: z.number().int().nonnegative(),
});
export type AgensiConversionRow = z.infer<typeof AgensiConversionRowSchema>;

export const AdminAiMetricsSchema = z.object({
  totalRuns: z.number().int().nonnegative(),
  totalTokensIn: z.number().int().nonnegative(),
  totalTokensOut: z.number().int().nonnegative(),
  approvedGates: z.number().int().nonnegative(),
  rejectedGates: z.number().int().nonnegative(),
  pendingGates: z.number().int().nonnegative(),
  abstentionEvents: z.number().int().nonnegative(),
});
export type AdminAiMetrics = z.infer<typeof AdminAiMetricsSchema>;

export interface AdminAnalyticsSummary {
  totalSessions: number;
  totalEvents: number;
}

export const AdminAnalyticsLoaderDataSchema = z.object({
  content: AdminAnalyticsContentSchema,
  window: AdminAnalyticsWindowSchema,
  totalSessions: z.number().int().nonnegative(),
  totalEvents: z.number().int().nonnegative(),
  summary: z.object({
    totalSessions: z.number().int().nonnegative(),
    totalEvents: z.number().int().nonnegative(),
  }),
  cwv: z.array(CwvPercentileRowSchema),
  topPaths: z.array(AnalyticsBreakdownRowSchema),
  topReferrers: z.array(AnalyticsBreakdownRowSchema),
  geoBreakdown: z.array(AnalyticsBreakdownRowSchema),
  agensiConversions: z.array(AgensiConversionRowSchema),
  aiMetrics: AdminAiMetricsSchema,
});
export type AdminAnalyticsLoaderData = z.infer<typeof AdminAnalyticsLoaderDataSchema>;

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

export const AdminCmsLoaderDataSchema = z.object({
  siteContents: z.array(SiteContentRowSchema),
  maintenanceModeDefault: z.boolean(),
  rebuildProgressPercent: z.number().int().min(0).max(100),
  menuItems: z.array(MenuItemSchema),
  terminalProfiles: z.array(AdminTerminalProfileRowSchema),
  terminalCommands: z.array(AdminTerminalCommandRowSchema),
  terminalInitialEntries: z.array(AdminTerminalInitialEntryRowSchema),
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
  runId: z.string().uuid(),
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

export * from './rbac.ts';
export * from './seo.ts';
