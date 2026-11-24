import { z } from 'zod';

import { AdminAnalyticsContentSchema } from './portal.ts';

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
