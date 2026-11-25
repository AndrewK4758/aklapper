import { z } from 'zod';

export const AgensiCatalogSourceSchema = z.enum([
  'agensi_api',
  'seed',
  'prerender',
  'manual_legacy',
]);
export type AgensiCatalogSource = z.infer<typeof AgensiCatalogSourceSchema>;

export const AgensiSyncStatusSchema = z.enum(['idle', 'ok', 'error', 'empty']);
export type AgensiSyncStatus = z.infer<typeof AgensiSyncStatusSchema>;

export const AgensiCatalogModeSchema = z.enum([
  'live',
  'cache',
  'cached_fallback',
  'prerender',
  'empty',
]);
export type AgensiCatalogMode = z.infer<typeof AgensiCatalogModeSchema>;

export const AgensiCatalogMetaSchema = z.object({
  mode: AgensiCatalogModeSchema,
  creatorHandle: z.string().min(1),
  syncedAt: z.iso.datetime().nullable(),
});
export type AgensiCatalogMeta = z.infer<typeof AgensiCatalogMetaSchema>;

export const AgensiSyncStateSchema = z.object({
  creatorHandle: z.string().min(1),
  lastSyncedAt: z.iso.datetime().nullable(),
  lastAttemptAt: z.iso.datetime().nullable(),
  lastStatus: AgensiSyncStatusSchema,
  lastError: z.string().nullable(),
  itemCount: z.number().int().nonnegative(),
});
export type AgensiSyncState = z.infer<typeof AgensiSyncStateSchema>;

export const AgensiRemoteCreatorRefSchema = z.object({
  slug: z.string().min(1).optional(),
  handle: z.string().min(1).optional(),
  id: z.string().min(1).optional(),
});
export type AgensiRemoteCreatorRef = z.infer<typeof AgensiRemoteCreatorRefSchema>;

export const AgensiRemoteSkillItemSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  summary: z.string().optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).default([]),
  url: z.string().min(1),
  sortOrder: z.number().int().nonnegative().optional(),
  sort_order: z.number().int().nonnegative().optional(),
  creatorHandle: z.string().min(1).optional(),
  creator_handle: z.string().min(1).optional(),
  creatorSlug: z.string().min(1).optional(),
  creator_slug: z.string().min(1).optional(),
  creatorId: z.string().min(1).optional(),
  creator_id: z.string().min(1).optional(),
  authorHandle: z.string().min(1).optional(),
  author_handle: z.string().min(1).optional(),
  creator: AgensiRemoteCreatorRefSchema.optional(),
  isPublished: z.boolean().optional(),
  is_published: z.boolean().optional(),
  published: z.boolean().optional(),
  status: z.string().min(1).optional(),
  install_count: z.number().int().nonnegative().optional(),
  vote_count: z.number().int().nonnegative().optional(),
  rating: z.number().nullable().optional(),
});
export type AgensiRemoteSkillItem = z.infer<typeof AgensiRemoteSkillItemSchema>;

export const AgensiRemoteResponseSchema = z.object({
  items: z.array(AgensiRemoteSkillItemSchema).optional(),
  skills: z.array(AgensiRemoteSkillItemSchema).optional(),
  data: z.array(AgensiRemoteSkillItemSchema).optional(),
  slug: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  bio: z.string().optional(),
  verified: z.boolean().optional(),
  skill_count: z.number().int().nonnegative().optional(),
  total_installs: z.number().int().nonnegative().optional(),
  url: z.string().min(1).optional(),
  creatorHandle: z.string().min(1).optional(),
  creator_handle: z.string().min(1).optional(),
  creatorSlug: z.string().min(1).optional(),
  creator_slug: z.string().min(1).optional(),
  creator: AgensiRemoteCreatorRefSchema.optional(),
  nextCursor: z.string().min(1).nullable().optional(),
  next_cursor: z.string().min(1).nullable().optional(),
  cursor: z.string().min(1).nullable().optional(),
  nextPage: z.number().int().positive().nullable().optional(),
  next_page: z.number().int().positive().nullable().optional(),
  page: z.number().int().positive().optional(),
  totalPages: z.number().int().nonnegative().optional(),
  total_pages: z.number().int().nonnegative().optional(),
});
export type AgensiRemoteResponse = z.infer<typeof AgensiRemoteResponseSchema>;

export const AgensiSkillSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  summary: z.string().min(1),
  tags: z.array(z.string()),
  url: z.url(),
  sortOrder: z.number().int().nonnegative(),
  creatorHandle: z.string().min(1).nullable().optional(),
  isPublished: z.boolean().optional(),
  syncedAt: z.iso.datetime().nullable().optional(),
  source: AgensiCatalogSourceSchema.optional(),
});
export type AgensiSkill = z.infer<typeof AgensiSkillSchema>;
