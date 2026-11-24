import { z } from 'zod';

export const RoleSchema = z.enum(['guest', 'admin']);
export type Role = z.infer<typeof RoleSchema>;

export const AuthSessionSchema = z.object({
  sessionId: z.string().min(1),
  role: RoleSchema,
  handle: z.string().min(1),
  expiresAt: z.iso.datetime(),
});
export type AuthSession = z.infer<typeof AuthSessionSchema>;

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
});
export type CadenceRunRequest = z.infer<typeof CadenceRunRequestSchema>;

export const CadenceGateVerdictSchema = z.enum(['pending', 'approved', 'rejected']);
export type CadenceGateVerdict = z.infer<typeof CadenceGateVerdictSchema>;

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
