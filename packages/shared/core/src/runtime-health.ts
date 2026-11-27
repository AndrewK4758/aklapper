import { z } from 'zod';

export const RuntimeServiceNameSchema = z.enum([
  'portal',
  'portal-api',
  'admin',
  'ai-ask',
  'cadence-demo',
  'postgres',
]);
export type RuntimeServiceName = z.infer<typeof RuntimeServiceNameSchema>;

export const RuntimeEnvironmentSchema = z.enum(['cloud-run', 'docker']);
export type RuntimeEnvironment = z.infer<typeof RuntimeEnvironmentSchema>;

export const RuntimeServiceHealthStateSchema = z.enum([
  'healthy',
  'degraded',
  'offline',
  'unconfigured',
]);
export type RuntimeServiceHealthState = z.infer<typeof RuntimeServiceHealthStateSchema>;

export const RuntimeServiceHealthItemSchema = z.object({
  service: RuntimeServiceNameSchema,
  runtime: RuntimeEnvironmentSchema,
  status: RuntimeServiceHealthStateSchema,
  latencyMs: z.number().int().nonnegative().nullable(),
  checkedAt: z.iso.datetime(),
  detail: z.string().optional(),
});
export type RuntimeServiceHealthItem = z.infer<typeof RuntimeServiceHealthItemSchema>;

export const RuntimeServiceHealthSnapshotSchema = z.object({
  runtime: RuntimeEnvironmentSchema,
  services: z.array(RuntimeServiceHealthItemSchema),
  summaryLabel: z.string().min(1),
  checkedAt: z.iso.datetime(),
  cached: z.boolean(),
});
export type RuntimeServiceHealthSnapshot = z.infer<typeof RuntimeServiceHealthSnapshotSchema>;
