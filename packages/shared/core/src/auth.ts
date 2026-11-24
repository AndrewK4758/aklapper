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

export const AuthSessionStatusSchema = z.object({
  authenticated: z.boolean(),
  session: AuthSessionSchema.nullable(),
  totpEnabled: z.boolean(),
  passkeyCount: z.number().int().nonnegative(),
});
export type AuthSessionStatus = z.infer<typeof AuthSessionStatusSchema>;

export const QuotaStatusSchema = z.object({
  role: RoleSchema,
  turnsUsed: z.number().int().nonnegative(),
  maxTurns: z.number().int().positive(),
  tokensUsed: z.number().int().nonnegative(),
  maxTokens: z.number().int().positive(),
});
export type QuotaStatus = z.infer<typeof QuotaStatusSchema>;
