import { z } from 'zod';

import { QuotaStatusSchema } from './auth.ts';
import { PublicAppErrorSchema } from './errors.ts';

export const AskModeSchema = z.enum(['qa', 'jd_match']);
export type AskMode = z.infer<typeof AskModeSchema>;

export const AskTurnStatusSchema = z.enum([
  'pending',
  'running',
  'completed',
  'abstained',
  'failed',
  'expired',
]);
export type AskTurnStatus = z.infer<typeof AskTurnStatusSchema>;

export const AskPortfolioRequestSchema = z.object({
  mode: z.literal('qa').default('qa'),
  question: z.string().trim().min(4).max(800),
  attemptId: z.uuid().optional(),
  sessionId: z.string().min(1).optional(),
});
export type AskPortfolioRequest = z.infer<typeof AskPortfolioRequestSchema>;

export const JdMatchRequestSchema = z.object({
  mode: z.literal('jd_match'),
  jobDescription: z.string().trim().min(20).max(8000),
  question: z.string().trim().max(800).optional(),
  attemptId: z.uuid().optional(),
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

export const JdMatchEvaluationSchema = z.object({
  matchScore: z.number().int().min(0).max(100),
  strengths: z.array(z.string()),
  gaps: z.array(z.string()),
});
export type JdMatchEvaluation = z.infer<typeof JdMatchEvaluationSchema>;

export const AskResponseSchema = z.object({
  attemptId: z.uuid().optional(),
  grounded: z.boolean(),
  abstained: z.boolean().optional(),
  mode: AskModeSchema,
  answer: z.string(),
  sources: z.array(AskSourceSchema),
  matchScore: z.number().int().min(0).max(100).optional(),
  strengths: z.array(z.string()).optional(),
  gaps: z.array(z.string()).optional(),
  provider: z.string().min(1),
  model: z.string().min(1).optional(),
  tokensUsed: z.number().int().nonnegative(),
  latencyMs: z.number().int().nonnegative().optional(),
  correlationId: z.string().min(1).optional(),
  quota: QuotaStatusSchema.optional(),
});
export type AskResponse = z.infer<typeof AskResponseSchema>;

export const AskTurnStateSchema = z.object({
  attemptId: z.uuid(),
  status: AskTurnStatusSchema,
  mode: AskModeSchema,
  correlationId: z.string().min(1),
  leaseExpiresAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  quota: QuotaStatusSchema.optional(),
  response: AskResponseSchema.optional(),
  error: PublicAppErrorSchema.optional(),
});
export type AskTurnState = z.infer<typeof AskTurnStateSchema>;

export const AskServiceStatusSchema = z.object({
  status: z.enum(['ready', 'degraded', 'offline']),
  provider: z.string().min(1),
  pointsCount: z.number().int().nonnegative(),
});
export type AskServiceStatus = z.infer<typeof AskServiceStatusSchema>;
