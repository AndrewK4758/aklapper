import { z } from 'zod';

import { AskSourceSchema } from './ask.ts';
import { QuotaStatusSchema } from './auth.ts';
import { AskSuggestedLinkSchema, GroundingTierSchema } from './career-dossiers.ts';
import { AppErrorCodeSchema, PublicAppErrorSchema } from './errors.ts';

export const StreamErrorPayloadSchema = z
  .object({
    ...PublicAppErrorSchema.shape,
    quota: QuotaStatusSchema.optional(),
  })
  .strict();
export type StreamErrorPayload = z.infer<typeof StreamErrorPayloadSchema>;

export const AskStreamStatusEventSchema = z.object({
  type: z.literal('status'),
  stage: z.string().min(1),
  label: z.string().min(1),
});

export const AskStreamMetaEventSchema = z.object({
  type: z.literal('meta'),
  attemptId: z.string().min(1),
  conversationId: z.string().min(1).optional(),
  turnIndex: z.number().int().positive().optional(),
  correlationId: z.string().min(1),
  mode: z.string().min(1),
  provider: z.string().min(1),
  model: z.string().optional(),
});

export const AskStreamPreambleEventSchema = z.object({
  type: z.literal('preamble'),
  text: z.string(),
});

export const AskStreamPreambleErrorEventSchema = z.object({
  type: z.literal('preamble_error'),
  code: AppErrorCodeSchema,
  message: z.string().min(1),
  action: z.string().min(1).optional(),
  correlationId: z.string().min(1),
});

export const AskStreamSourcesEventSchema = z.object({
  type: z.literal('sources'),
  sources: z.array(AskSourceSchema),
});

export const AskStreamDeltaEventSchema = z.object({
  type: z.literal('delta'),
  text: z.string(),
});

export const AskStreamDoneEventSchema = z.object({
  type: z.literal('done'),
  attemptId: z.string().min(1),
  conversationId: z.string().min(1).optional(),
  turnIndex: z.number().int().positive().optional(),
  grounded: z.boolean(),
  abstained: z.boolean(),
  groundingTier: GroundingTierSchema.optional(),
  answer: z.string(),
  suggestedLinks: z.array(AskSuggestedLinkSchema).optional(),
  followUpQuestions: z.array(z.string()).optional(),
  provider: z.string().min(1),
  model: z.string().optional(),
  tokensUsed: z.number().int().nonnegative(),
  usageEstimated: z.boolean().optional(),
  latencyMs: z.number().int().nonnegative().optional(),
  correlationId: z.string().min(1),
  quota: QuotaStatusSchema.optional(),
});

export const AskStreamErrorEventSchema = z.object({
  type: z.literal('error'),
  error: StreamErrorPayloadSchema,
});

export const AskStreamEventSchema = z.discriminatedUnion('type', [
  AskStreamStatusEventSchema,
  AskStreamMetaEventSchema,
  AskStreamPreambleEventSchema,
  AskStreamPreambleErrorEventSchema,
  AskStreamSourcesEventSchema,
  AskStreamDeltaEventSchema,
  AskStreamDoneEventSchema,
  AskStreamErrorEventSchema,
]);
export type AskStreamEvent = z.infer<typeof AskStreamEventSchema>;
