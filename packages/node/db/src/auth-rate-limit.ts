import { sql } from 'drizzle-orm';

import type { AppDatabase } from './client.ts';
import * as schema from './schema.ts';

export interface AuthRateLimitOptions {
  maxAttempts: number;
  windowMs: number;
}

export interface AuthRateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export async function consumeAuthRateLimit(
  db: AppDatabase,
  scopeKey: string,
  options: AuthRateLimitOptions,
): Promise<AuthRateLimitResult> {
  const maxAttempts = Math.max(1, Math.floor(options.maxAttempts));
  const windowMs = Math.max(1_000, Math.floor(options.windowMs));
  const now = new Date();
  const windowCutoffIso = new Date(now.getTime() - windowMs).toISOString();
  const nowIso = now.toISOString();

  const [row] = await db
    .insert(schema.rateLimitBuckets)
    .values({
      scopeKey,
      windowStart: now,
      turnsUsed: 1,
      tokensUsed: 0,
    })
    .onConflictDoUpdate({
      target: schema.rateLimitBuckets.scopeKey,
      set: {
        windowStart: sql`CASE WHEN ${schema.rateLimitBuckets.windowStart} <= ${windowCutoffIso}::timestamptz THEN ${nowIso}::timestamptz ELSE ${schema.rateLimitBuckets.windowStart} END`,
        turnsUsed: sql`CASE WHEN ${schema.rateLimitBuckets.windowStart} <= ${windowCutoffIso}::timestamptz THEN 1 ELSE LEAST(${schema.rateLimitBuckets.turnsUsed} + 1, ${maxAttempts + 1}) END`,
      },
    })
    .returning({
      windowStart: schema.rateLimitBuckets.windowStart,
      turnsUsed: schema.rateLimitBuckets.turnsUsed,
    });

  if (!row) {
    throw new Error(`Failed to update auth rate limit bucket "${scopeKey}"`);
  }

  const attempts = Number(row.turnsUsed);
  const allowed = attempts <= maxAttempts;
  const remaining = Math.max(0, maxAttempts - attempts);
  const resetAtMs = row.windowStart.getTime() + windowMs;
  const retryAfterSeconds = Math.max(1, Math.ceil((resetAtMs - now.getTime()) / 1000));

  return {
    allowed,
    remaining,
    retryAfterSeconds,
  };
}
