import { z } from 'zod';

export const AdminAnalyticsWindowSchema = z.enum(['24h', '7d', '30d', 'all']);
export type AdminAnalyticsWindow = z.infer<typeof AdminAnalyticsWindowSchema>;

export const AnalyticsAppSchema = z.enum(['portal', 'admin']);
export type AnalyticsApp = z.infer<typeof AnalyticsAppSchema>;

export const ReferrerCategorySchema = z.enum([
  'direct',
  'search',
  'social',
  'developer',
  'referral',
]);
export type ReferrerCategory = z.infer<typeof ReferrerCategorySchema>;

export const DeviceTypeSchema = z.enum(['desktop', 'mobile', 'tablet', 'bot', 'unknown']);
export type DeviceType = z.infer<typeof DeviceTypeSchema>;

export const AdminAnalyticsBotsModeSchema = z.enum(['exclude', 'include', 'only']);
export type AdminAnalyticsBotsMode = z.infer<typeof AdminAnalyticsBotsModeSchema>;

export const AdminAnalyticsIdentifiedFilterSchema = z.enum(['all', 'true']);
export type AdminAnalyticsIdentifiedFilter = z.infer<typeof AdminAnalyticsIdentifiedFilterSchema>;

export const AdminAnalyticsFilterSchema = z.object({
  window: AdminAnalyticsWindowSchema.default('7d'),
  source: z.string().trim().min(1).max(160).optional(),
  country: z.string().trim().min(1).max(64).optional(),
  path: z.string().trim().min(1).max(256).optional(),
  campaign: z.string().trim().min(1).max(160).optional(),
  bots: AdminAnalyticsBotsModeSchema.default('exclude'),
  identified: AdminAnalyticsIdentifiedFilterSchema.default('all'),
});
export type AdminAnalyticsFilter = z.infer<typeof AdminAnalyticsFilterSchema>;

export interface ParsedAdminAnalyticsFilter {
  readonly filter: AdminAnalyticsFilter;
  readonly clampedFields: readonly string[];
}

function readRawParam(
  input: URLSearchParams | Record<string, string | null | undefined>,
  key: string,
): string | null {
  if (input instanceof URLSearchParams) {
    return input.get(key);
  }
  const value = input[key];
  return typeof value === 'string' ? value : null;
}

function clampOptionalString(
  raw: string | null,
  maxLength: number,
  fieldName: string,
  clampedFields: string[],
): string | undefined {
  if (raw === null) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > maxLength) {
    clampedFields.push(fieldName);
    return trimmed.slice(0, maxLength);
  }
  return trimmed;
}

export function parseAdminAnalyticsFilter(
  input: URLSearchParams | Record<string, string | null | undefined>,
): ParsedAdminAnalyticsFilter {
  const clampedFields: string[] = [];

  const rawWindow = readRawParam(input, 'window');
  const parsedWindow = AdminAnalyticsWindowSchema.safeParse(rawWindow);
  if (rawWindow !== null && rawWindow.trim() !== '' && !parsedWindow.success) {
    clampedFields.push('window');
  }
  const windowValue: AdminAnalyticsWindow = parsedWindow.success ? parsedWindow.data : '7d';

  const rawBots = readRawParam(input, 'bots');
  const parsedBots = AdminAnalyticsBotsModeSchema.safeParse(rawBots);
  if (rawBots !== null && rawBots.trim() !== '' && !parsedBots.success) {
    clampedFields.push('bots');
  }
  const botsValue: AdminAnalyticsBotsMode = parsedBots.success ? parsedBots.data : 'exclude';

  const rawIdentified = readRawParam(input, 'identified');
  const parsedIdentified = AdminAnalyticsIdentifiedFilterSchema.safeParse(rawIdentified);
  if (rawIdentified !== null && rawIdentified.trim() !== '' && !parsedIdentified.success) {
    clampedFields.push('identified');
  }
  const identifiedValue: AdminAnalyticsIdentifiedFilter = parsedIdentified.success
    ? parsedIdentified.data
    : 'all';

  const source = clampOptionalString(readRawParam(input, 'source'), 160, 'source', clampedFields);
  const country = clampOptionalString(readRawParam(input, 'country'), 64, 'country', clampedFields);
  const path = clampOptionalString(readRawParam(input, 'path'), 256, 'path', clampedFields);
  const campaign = clampOptionalString(
    readRawParam(input, 'campaign'),
    160,
    'campaign',
    clampedFields,
  );

  const filter: AdminAnalyticsFilter = {
    window: windowValue,
    bots: botsValue,
    identified: identifiedValue,
    ...(source !== undefined ? { source } : {}),
    ...(country !== undefined ? { country } : {}),
    ...(path !== undefined ? { path } : {}),
    ...(campaign !== undefined ? { campaign } : {}),
  };

  return { filter, clampedFields };
}

export const AnalyticsDailyTrendPointSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  uniqueVisitors: z.number().int().nonnegative(),
  sessions: z.number().int().nonnegative(),
  pageViews: z.number().int().nonnegative(),
});
export type AnalyticsDailyTrendPoint = z.infer<typeof AnalyticsDailyTrendPointSchema>;

export const AnalyticsFunnelStepSchema = z.object({
  step: z.string().min(1),
  label: z.string().min(1),
  sessions: z.number().int().nonnegative(),
  conversionRate: z.number().min(0).max(1),
});
export type AnalyticsFunnelStep = z.infer<typeof AnalyticsFunnelStepSchema>;

export const AnalyticsTrailEventSchema = z.object({
  type: z.enum(['page_view', 'interaction', 'web_vital', 'error']),
  name: z.string().min(1),
  path: z.string().min(1),
  detail: z.string().nullable().optional(),
  createdAt: z.iso.datetime(),
});
export type AnalyticsTrailEvent = z.infer<typeof AnalyticsTrailEventSchema>;

export const AnalyticsRecentVisitorSchema = z.object({
  sessionId: z.string().min(1),
  startedAt: z.iso.datetime(),
  lastSeenAt: z.iso.datetime(),
  isBot: z.boolean(),
  country: z.string().nullable(),
  region: z.string().nullable(),
  city: z.string().nullable(),
  asnOrg: z.string().nullable(),
  referrerHost: z.string().nullable(),
  referrerCategory: ReferrerCategorySchema.nullable(),
  landingPath: z.string().nullable(),
  refParam: z.string().nullable(),
  utmSource: z.string().nullable(),
  utmMedium: z.string().nullable(),
  utmCampaign: z.string().nullable(),
  deviceType: DeviceTypeSchema.nullable(),
  osName: z.string().nullable(),
  browserName: z.string().nullable(),
  pageViewCount: z.number().int().nonnegative(),
  eventCount: z.number().int().nonnegative(),
  askTurnCount: z.number().int().nonnegative(),
  contactId: z.string().nullable(),
  contactName: z.string().nullable(),
  contactEmail: z.string().nullable(),
  trail: z.array(AnalyticsTrailEventSchema).max(15),
});
export type AnalyticsRecentVisitor = z.infer<typeof AnalyticsRecentVisitorSchema>;

export const AnalyticsAskTurnItemSchema = z.object({
  attemptId: z.string().min(1),
  guestSessionId: z.string().min(1),
  analyticsSessionId: z.string().nullable(),
  mode: z.enum(['qa', 'jd_match']),
  status: z.enum(['pending', 'running', 'completed', 'abstained', 'failed', 'expired']),
  promptExcerpt: z.string().nullable(),
  tokensUsed: z.number().int().nonnegative(),
  country: z.string().nullable(),
  region: z.string().nullable(),
  city: z.string().nullable(),
  asnOrg: z.string().nullable(),
  contactId: z.string().nullable(),
  contactName: z.string().nullable(),
  createdAt: z.iso.datetime(),
});
export type AnalyticsAskTurnItem = z.infer<typeof AnalyticsAskTurnItemSchema>;

export const InboxVisitorContextSchema = z.object({
  analyticsSessionId: z.string().nullable(),
  guestSessionId: z.string().nullable(),
  country: z.string().nullable(),
  region: z.string().nullable(),
  city: z.string().nullable(),
  asnOrg: z.string().nullable(),
  referrerHost: z.string().nullable(),
  referrerCategory: ReferrerCategorySchema.nullable(),
  landingPath: z.string().nullable(),
  refParam: z.string().nullable(),
  utmSource: z.string().nullable(),
  utmCampaign: z.string().nullable(),
  deviceType: DeviceTypeSchema.nullable(),
  osName: z.string().nullable(),
  browserName: z.string().nullable(),
  viewedPaths: z.array(z.string()).max(6),
  paneOpenCount: z.number().int().nonnegative(),
  askTurnCount: z.number().int().nonnegative(),
  latestAskPromptExcerpt: z.string().nullable(),
  startedAt: z.iso.datetime().nullable(),
  lastSeenAt: z.iso.datetime().nullable(),
});
export const AdminInboxVisitorContextSchema = InboxVisitorContextSchema;
export type InboxVisitorContext = z.infer<typeof InboxVisitorContextSchema>;
export type AdminInboxVisitorContext = InboxVisitorContext;

export const AnalyticsIngestResponseSchema = z.object({
  accepted: z.number().int().nonnegative(),
  sessionId: z.string().min(1),
  ipHash: z.string().min(1),
});
export type AnalyticsIngestResponse = z.infer<typeof AnalyticsIngestResponseSchema>;
