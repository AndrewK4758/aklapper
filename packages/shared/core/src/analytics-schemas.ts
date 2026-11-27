import { z } from 'zod';

import {
  AdminAnalyticsFilterSchema,
  AdminAnalyticsWindowSchema,
  AnalyticsAskTurnItemSchema,
  AnalyticsDailyTrendPointSchema,
  AnalyticsFunnelStepSchema,
  AnalyticsRecentVisitorSchema,
} from './analytics-admin-schemas.ts';
import { AdminAnalyticsContentSchema } from './portal.ts';

export * from './analytics-admin-schemas.ts';

const utf8Encoder = new TextEncoder();

export const ANALYTICS_MAX_METADATA_KEYS = 16;
export const ANALYTICS_MAX_METADATA_STRING_CHARS = 256;
export const ANALYTICS_MAX_EVENT_METADATA_BYTES = 2_048;
export const ANALYTICS_MAX_BATCH_BYTES = 64 * 1024;

function utf8ByteLength(value: string): number {
  return utf8Encoder.encode(value).byteLength;
}

function withoutNul(schema: z.ZodString): z.ZodString {
  return schema.refine(value => !value.includes('\0'), 'String must not contain NUL bytes');
}

const AnalyticsMetadataValueSchema = z.union([
  withoutNul(z.string().max(ANALYTICS_MAX_METADATA_STRING_CHARS)),
  z.number().finite(),
  z.boolean(),
]);

const AnalyticsEventMetadataSchema = z
  .record(withoutNul(z.string().min(1).max(64)), AnalyticsMetadataValueSchema)
  .refine(
    meta => Object.keys(meta).length <= ANALYTICS_MAX_METADATA_KEYS,
    `Metadata cannot exceed ${ANALYTICS_MAX_METADATA_KEYS} keys`,
  )
  .refine(
    meta => utf8ByteLength(JSON.stringify(meta)) <= ANALYTICS_MAX_EVENT_METADATA_BYTES,
    `Serialized metadata cannot exceed ${ANALYTICS_MAX_EVENT_METADATA_BYTES} bytes`,
  );

export const AnalyticsEventSchema = z.object({
  type: z.enum(['page_view', 'interaction', 'web_vital', 'error']),
  name: withoutNul(z.string().trim().min(1).max(120)),
  path: withoutNul(z.string().trim().min(1).max(512)),
  value: z.number().finite().optional(),
  metadata: AnalyticsEventMetadataSchema.optional(),
  timestamp: z.iso.datetime(),
});
export type AnalyticsEvent = z.infer<typeof AnalyticsEventSchema>;

export const AnalyticsBatchSchema = z
  .object({
    sessionId: withoutNul(z.string().trim().min(1).max(128)),
    referrer: withoutNul(z.string().max(1024)).optional(),
    landingPath: withoutNul(z.string().max(512)).optional(),
    refParam: withoutNul(z.string().max(512)).optional(),
    utmSource: withoutNul(z.string().max(512)).optional(),
    utmMedium: withoutNul(z.string().max(512)).optional(),
    utmCampaign: withoutNul(z.string().max(512)).optional(),
    utmContent: withoutNul(z.string().max(512)).optional(),
    events: z.array(AnalyticsEventSchema).min(1).max(50),
  })
  .refine(
    batch => utf8ByteLength(JSON.stringify(batch)) <= ANALYTICS_MAX_BATCH_BYTES,
    `Serialized analytics batch cannot exceed ${ANALYTICS_MAX_BATCH_BYTES} bytes`,
  );
export type AnalyticsBatch = z.infer<typeof AnalyticsBatchSchema>;

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
  uniqueVisitors: z.number().int().nonnegative().optional(),
  filterValue: z.string().optional(),
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

export const AdminAnalyticsSummaryDataSchema = z.object({
  content: AdminAnalyticsContentSchema,
  window: AdminAnalyticsWindowSchema,
  filters: AdminAnalyticsFilterSchema.optional(),
  totalSessions: z.number().int().nonnegative(),
  totalEvents: z.number().int().nonnegative(),
  uniqueVisitors: z.number().int().nonnegative().optional(),
  returningVisitors: z.number().int().nonnegative().optional(),
  totalPageViews: z.number().int().nonnegative().optional(),
  profileViews: z.number().int().nonnegative().optional(),
  highIntentActions: z.number().int().nonnegative().optional(),
  identifiedLeads: z.number().int().nonnegative().optional(),
  botSessionsExcluded: z.number().int().nonnegative().optional(),
  dailyTrend: z.array(AnalyticsDailyTrendPointSchema).optional(),
  summary: z.object({
    totalSessions: z.number().int().nonnegative(),
    totalEvents: z.number().int().nonnegative(),
  }),
  cwv: z.array(CwvPercentileRowSchema),
  aiMetrics: AdminAiMetricsSchema,
});
export type AdminAnalyticsSummaryData = z.infer<typeof AdminAnalyticsSummaryDataSchema>;

export const AdminAnalyticsBreakdownsDataSchema = z.object({
  topPaths: z.array(AnalyticsBreakdownRowSchema),
  topReferrers: z.array(AnalyticsBreakdownRowSchema),
  geoBreakdown: z.array(AnalyticsBreakdownRowSchema),
  agensiConversions: z.array(AgensiConversionRowSchema),
  orgBreakdown: z.array(AnalyticsBreakdownRowSchema).optional(),
  campaignBreakdown: z.array(AnalyticsBreakdownRowSchema).optional(),
  deviceBreakdown: z.array(AnalyticsBreakdownRowSchema).optional(),
  osBreakdown: z.array(AnalyticsBreakdownRowSchema).optional(),
  browserBreakdown: z.array(AnalyticsBreakdownRowSchema).optional(),
  conversionFunnel: z.array(AnalyticsFunnelStepSchema).optional(),
  recentVisitors: z.array(AnalyticsRecentVisitorSchema).optional(),
  askTurnsFeed: z.array(AnalyticsAskTurnItemSchema).optional(),
});
export type AdminAnalyticsBreakdownsData = z.infer<typeof AdminAnalyticsBreakdownsDataSchema>;

export const AdminAnalyticsLoaderDataSchema = AdminAnalyticsSummaryDataSchema.extend(
  AdminAnalyticsBreakdownsDataSchema.shape,
);
export type AdminAnalyticsLoaderData = z.infer<typeof AdminAnalyticsLoaderDataSchema>;
