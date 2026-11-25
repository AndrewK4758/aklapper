import { z } from 'zod';

import { PORTAL_NAVIGABLE_ROUTE_PATHS } from './routes.ts';

export const CAREER_DOSSIER_KINDS = [
  'profile_core',
  'experience',
  'project',
  'architecture',
  'leadership',
] as const;

export const CareerDossierKindSchema = z.enum(CAREER_DOSSIER_KINDS);
export type CareerDossierKind = z.infer<typeof CareerDossierKindSchema>;

export const CAREER_DOSSIER_PUBLISH_STATUSES = ['draft', 'published'] as const;

export const CareerDossierPublishStatusSchema = z.enum(CAREER_DOSSIER_PUBLISH_STATUSES);
export type CareerDossierPublishStatus = z.infer<typeof CareerDossierPublishStatusSchema>;

export const CareerDossierSectionSchema = z.object({
  heading: z.string().trim().min(1).max(160),
  body: z.string().trim().min(1).max(6000),
});
export type CareerDossierSection = z.infer<typeof CareerDossierSectionSchema>;

export const CareerDossierSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9-]+$/),
  kind: CareerDossierKindSchema,
  title: z.string().trim().min(1).max(160),
  domainLabel: z.string().trim().min(1).max(120),
  roleTitle: z.string().trim().min(1).max(120),
  timeframe: z.string().trim().min(1).max(80),
  skills: z.array(z.string().trim().min(1).max(80)).max(64),
  summaryBody: z.string().trim().min(1).max(4000),
  sections: z.array(CareerDossierSectionSchema).max(32),
  publishStatus: CareerDossierPublishStatusSchema,
  sanitizationVerifiedAt: z.iso.datetime().nullable(),
  denylistHash: z.string().min(1).nullable().optional(),
  sortOrder: z.number().int().min(0).max(1000),
  updatedAt: z.iso.datetime(),
});
export type CareerDossier = z.infer<typeof CareerDossierSchema>;

export const CareerDossierUpsertSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9-]+$/),
  kind: CareerDossierKindSchema,
  title: z.string().trim().min(1).max(160),
  domainLabel: z.string().trim().min(1).max(120),
  roleTitle: z.string().trim().min(1).max(120),
  timeframe: z.string().trim().min(1).max(80),
  skills: z.array(z.string().trim().min(1).max(80)).max(64).default([]),
  summaryBody: z.string().trim().min(1).max(4000),
  sections: z.array(CareerDossierSectionSchema).max(32).default([]),
  sortOrder: z.coerce.number().int().min(0).max(1000).default(0),
});
export type CareerDossierUpsertInput = z.infer<typeof CareerDossierUpsertSchema>;

export const PrivacySanitizationCategorySchema = z.enum([
  'secret',
  'pii',
  'tracker',
  'workspace',
  'denylist',
  'config',
]);
export type PrivacySanitizationCategory = z.infer<typeof PrivacySanitizationCategorySchema>;

export const PrivacySanitizationFindingSchema = z.object({
  ruleId: z.string().min(1),
  category: PrivacySanitizationCategorySchema,
  field: z.string().min(1),
  location: z.string().min(1),
});
export type PrivacySanitizationFinding = z.infer<typeof PrivacySanitizationFindingSchema>;

export const GroundingTierSchema = z.enum(['profile', 'evidence', 'boundary']);
export type GroundingTier = z.infer<typeof GroundingTierSchema>;

export const AskSuggestedLinkSchema = z.object({
  route: z.enum(PORTAL_NAVIGABLE_ROUTE_PATHS),
  label: z.string().trim().min(1).max(120),
  reason: z.string().trim().min(1).max(240),
});
export type AskSuggestedLink = z.infer<typeof AskSuggestedLinkSchema>;
