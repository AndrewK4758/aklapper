import { z } from 'zod';

import { AgensiSkillSchema, AgensiSyncStateSchema } from './agensi.ts';
import { CareerDossierSchema } from './career-dossiers.ts';
import { CadencePresetSchema, MenuItemSchema, RoadmapMilestoneSchema } from './portal.ts';
import {
  TerminalCommandKindSchema,
  TerminalDirectoryEntrySchema,
  TerminalEntryStatusSchema,
  TerminalVcsStateSchema,
} from './terminal.ts';

export const SiteContentRowSchema = z.object({
  key: z.string().min(1),
  markdownBody: z.string(),
  metadataJson: z.record(z.string(), z.unknown()),
  updatedAt: z.iso.datetime(),
});
export type SiteContentRow = z.infer<typeof SiteContentRowSchema>;

export const AdminTerminalProfileRowSchema = z.object({
  slug: z.string().min(1),
  bannerTitle: z.string().min(1),
  bannerMeta: z.string().min(1),
  osLabel: z.string().min(1),
  directory: z.string().min(1),
  vcsBranch: z.string().min(1),
  vcsState: TerminalVcsStateSchema,
  contextLabel: z.string().min(1),
  placeholder: z.string().min(1),
  quickCommands: z.array(z.string()),
});
export type AdminTerminalProfileRow = z.infer<typeof AdminTerminalProfileRowSchema>;

export const AdminTerminalCommandRowSchema = z.object({
  id: z.number().int().positive(),
  profileSlug: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  kind: TerminalCommandKindSchema,
  output: z.string(),
  targetRoute: z.string().nullable(),
  allowedRoutes: z.array(z.string()),
  errorTemplate: z.string().nullable(),
  sortOrder: z.number().int().nonnegative(),
});
export type AdminTerminalCommandRow = z.infer<typeof AdminTerminalCommandRowSchema>;

export const AdminTerminalInitialEntryRowSchema = z.object({
  id: z.number().int().positive(),
  profileSlug: z.string().min(1),
  command: z.string().min(1),
  output: z.string(),
  status: TerminalEntryStatusSchema,
  durationLabel: z.string().min(1),
  timestampLabel: z.string().min(1),
  sortOrder: z.number().int().nonnegative(),
});
export type AdminTerminalInitialEntryRow = z.infer<typeof AdminTerminalInitialEntryRowSchema>;

export const AdminTerminalDirectoryEntryRowSchema = TerminalDirectoryEntrySchema.extend({
  id: z.number().int().positive(),
  profileSlug: z.string().min(1),
});
export type AdminTerminalDirectoryEntryRow = z.infer<typeof AdminTerminalDirectoryEntryRowSchema>;

export const AdminCmsLoaderDataSchema = z.object({
  siteContents: z.array(SiteContentRowSchema),
  maintenanceModeDefault: z.boolean(),
  rebuildProgressPercent: z.number().int().min(0).max(100),
  menuItems: z.array(MenuItemSchema),
  terminalProfiles: z.array(AdminTerminalProfileRowSchema),
  terminalCommands: z.array(AdminTerminalCommandRowSchema),
  terminalInitialEntries: z.array(AdminTerminalInitialEntryRowSchema),
  terminalDirectoryEntries: z.array(AdminTerminalDirectoryEntryRowSchema).default([]),
  roadmapMilestones: z.array(RoadmapMilestoneSchema),
  agensiSkills: z.array(AgensiSkillSchema),
  agensiSyncState: AgensiSyncStateSchema.nullable().optional(),
  cadencePresets: z.array(CadencePresetSchema),
  careerDossiers: z.array(CareerDossierSchema).default([]),
});
export type AdminCmsLoaderData = z.infer<typeof AdminCmsLoaderDataSchema>;

export const SiteContentUpsertSchema = z.object({
  key: z.string().trim().min(1).max(120),
  markdownBody: z.string(),
  metadataJson: z.record(z.string(), z.unknown()),
});
export type SiteContentUpsertInput = z.infer<typeof SiteContentUpsertSchema>;

export const MaintenanceModeUpdateSchema = z.object({
  enabled: z.boolean(),
  rebuildProgressPercent: z.coerce.number().int().min(0).max(100).optional(),
});
export type MaintenanceModeUpdateInput = z.infer<typeof MaintenanceModeUpdateSchema>;
