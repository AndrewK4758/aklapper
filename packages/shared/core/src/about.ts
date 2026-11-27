import { z } from 'zod';

import { StatusBadgeSpecSchema } from './portal.ts';
import { PORTAL_NAVIGABLE_ROUTE_PATHS } from './routes.ts';

const US_POSTAL_ZIP_RE = /\b\d{5}(?:-\d{4})?\b/;

function hasAsciiControlChar(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) {
      return true;
    }
  }
  return false;
}

export function isSafeHttpUrl(raw: string): boolean {
  if (hasAsciiControlChar(raw)) {
    return false;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return false;
  }
  try {
    const parsed = new URL(trimmed);
    return (
      (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
      parsed.username === '' &&
      parsed.password === ''
    );
  } catch {
    return false;
  }
}

const SafeHttpUrlSchema = z
  .string()
  .refine(val => !hasAsciiControlChar(val), 'URL must not contain control characters')
  .trim()
  .pipe(z.url({ protocol: /^https?$/ }))
  .refine(isSafeHttpUrl, 'URL must use http(s) without control characters or embedded credentials');

export const PortalAboutIdentitySchema = z.object({
  fullName: z.string().trim().min(1).max(80),
  roleHeadline: z.string().trim().min(1).max(120),
  location: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .refine(val => !US_POSTAL_ZIP_RE.test(val), 'Location must omit postal ZIP codes'),
  githubLabel: z.string().trim().min(1).max(80),
  githubUrl: SafeHttpUrlSchema,
  websiteLabel: z.string().trim().min(1).max(80),
  websiteUrl: SafeHttpUrlSchema,
});
export type PortalAboutIdentity = z.infer<typeof PortalAboutIdentitySchema>;

export const PortalAboutPortraitSchema = z.object({
  alt: z.string().trim().min(1).max(160),
  caption: z.string().trim().min(1).max(160),
  ttyLabel: z.string().trim().min(1).max(64).default('portrait // greyscale'),
});
export type PortalAboutPortrait = z.infer<typeof PortalAboutPortraitSchema>;

export const PortalAboutSkillGroupSchema = z.object({
  category: z.string().trim().min(1).max(80),
  skills: z.array(z.string().trim().min(1).max(80)).min(1),
});
export type PortalAboutSkillGroup = z.infer<typeof PortalAboutSkillGroupSchema>;

export const PortalAboutEducationSchema = z.object({
  institution: z.string().trim().min(1).max(120),
  location: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .refine(val => !US_POSTAL_ZIP_RE.test(val), 'Location must omit postal ZIP codes'),
  program: z.string().trim().min(1).max(160),
});
export type PortalAboutEducation = z.infer<typeof PortalAboutEducationSchema>;

export const PortalAboutServiceCardSchema = z.object({
  id: z.string().trim().min(1).max(32),
  title: z.string().trim().min(1).max(80),
  to: z.enum(PORTAL_NAVIGABLE_ROUTE_PATHS),
  badge: z.string().trim().min(1).max(40),
  summary: z.string().trim().min(1).max(320),
  ctaLabel: z.string().trim().min(1).max(60),
});
export type PortalAboutServiceCard = z.infer<typeof PortalAboutServiceCardSchema>;

export const PortalAboutContentSchema = z.object({
  windowTitle: z.string().trim().min(1).max(120),
  statusBadge: StatusBadgeSpecSchema,
  description: z.string().trim().min(1).max(400),
  identity: PortalAboutIdentitySchema,
  portrait: PortalAboutPortraitSchema,
  skillsHeading: z.string().trim().min(1).max(80).default('Technical Skills'),
  skillGroups: z.array(PortalAboutSkillGroupSchema).min(1),
  experienceHeading: z.string().trim().min(1).max(80).default('Experience'),
  projectsHeading: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .default('Independent R&D & Open-Source Projects'),
  communityHeading: z.string().trim().min(1).max(80).default('Community & Education'),
  education: z.array(PortalAboutEducationSchema).min(1),
  servicesHeading: z.string().trim().min(1).max(100).default('Platform Services Guide'),
  servicesIntro: z.string().trim().min(1).max(320),
  services: z.array(PortalAboutServiceCardSchema).min(1),
  contactCtaLabel: z.string().trim().min(1).max(80).default('Contact Andrew Directly'),
  contactCtaHref: z.enum(PORTAL_NAVIGABLE_ROUTE_PATHS).default('/contact'),
  emptyDossiersNotice: z
    .string()
    .trim()
    .min(1)
    .max(240)
    .default(
      'Published career dossiers are currently being refreshed. Explore the services below or reach out via Contact.',
    ),
});
export type PortalAboutContent = z.infer<typeof PortalAboutContentSchema>;
