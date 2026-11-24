import { z } from 'zod';

import {
  AdminAnalyticsContentSchema,
  AdminChromeContentSchema,
  AdminHomeContentSchema,
  PortalAgensiContentSchema,
  PortalAskContentSchema,
  PortalCadenceContentSchema,
  PortalChromeContentSchema,
  PortalContactContentSchema,
  PortalHomeContentSchema,
  PortalMaintenanceContentSchema,
  PortalMenuContentSchema,
} from './portal.ts';

export const SITE_CONTENT_KEYS = {
  portalChrome: 'portal-chrome',
  portalHome: 'portal-home',
  portalMenu: 'portal-menu',
  portalAgensi: 'portal-agensi',
  portalAsk: 'portal-ask',
  portalCadence: 'portal-cadence',
  portalContact: 'portal-contact',
  portalMaintenance: 'portal-maintenance',
  adminChrome: 'admin-chrome',
  adminHome: 'admin-home',
  adminAnalytics: 'admin-analytics',
} as const;

export type SiteContentKey = (typeof SITE_CONTENT_KEYS)[keyof typeof SITE_CONTENT_KEYS];

export interface SiteContentKeyMetadata {
  readonly key: SiteContentKey;
  readonly label: string;
  readonly description: string;
  readonly surface: 'portal' | 'admin';
}

export const SITE_CONTENT_SCHEMA_BY_KEY: Readonly<
  Record<SiteContentKey, z.ZodType<Record<string, unknown>>>
> = {
  [SITE_CONTENT_KEYS.portalChrome]: PortalChromeContentSchema,
  [SITE_CONTENT_KEYS.portalHome]: PortalHomeContentSchema,
  [SITE_CONTENT_KEYS.portalMenu]: PortalMenuContentSchema,
  [SITE_CONTENT_KEYS.portalAgensi]: PortalAgensiContentSchema,
  [SITE_CONTENT_KEYS.portalAsk]: PortalAskContentSchema,
  [SITE_CONTENT_KEYS.portalCadence]: PortalCadenceContentSchema,
  [SITE_CONTENT_KEYS.portalContact]: PortalContactContentSchema,
  [SITE_CONTENT_KEYS.portalMaintenance]: PortalMaintenanceContentSchema,
  [SITE_CONTENT_KEYS.adminChrome]: AdminChromeContentSchema,
  [SITE_CONTENT_KEYS.adminHome]: AdminHomeContentSchema,
  [SITE_CONTENT_KEYS.adminAnalytics]: AdminAnalyticsContentSchema,
};

export const SITE_CONTENT_METADATA: Readonly<Record<SiteContentKey, SiteContentKeyMetadata>> = {
  [SITE_CONTENT_KEYS.portalChrome]: {
    key: SITE_CONTENT_KEYS.portalChrome,
    label: 'Portal Chrome',
    description: 'Top navigation bar, footer, status badge, and default maintenance toggle.',
    surface: 'portal',
  },
  [SITE_CONTENT_KEYS.portalHome]: {
    key: SITE_CONTENT_KEYS.portalHome,
    label: 'Portal Home',
    description: 'Primary launcher hero window, heading, description, and action buttons.',
    surface: 'portal',
  },
  [SITE_CONTENT_KEYS.portalMenu]: {
    key: SITE_CONTENT_KEYS.portalMenu,
    label: 'Portal Menu',
    description: 'Command menu window heading, description, and local route badge label.',
    surface: 'portal',
  },
  [SITE_CONTENT_KEYS.portalAgensi]: {
    key: SITE_CONTENT_KEYS.portalAgensi,
    label: 'Portal Agensi',
    description: 'Agensi skill catalog header, search placeholder, empty state, and CTA.',
    surface: 'portal',
  },
  [SITE_CONTENT_KEYS.portalAsk]: {
    key: SITE_CONTENT_KEYS.portalAsk,
    label: 'Portal Ask',
    description:
      'AI Ask portfolio window copy, starter questions, JD input, and abstention notice.',
    surface: 'portal',
  },
  [SITE_CONTENT_KEYS.portalCadence]: {
    key: SITE_CONTENT_KEYS.portalCadence,
    label: 'Portal CADENCE',
    description: 'CADENCE interactive demo window title, status badge, copy, and frame label.',
    surface: 'portal',
  },
  [SITE_CONTENT_KEYS.portalContact]: {
    key: SITE_CONTENT_KEYS.portalContact,
    label: 'Portal Contact',
    description: 'Contact page header and recursive form fieldsets/fields definition.',
    surface: 'portal',
  },
  [SITE_CONTENT_KEYS.portalMaintenance]: {
    key: SITE_CONTENT_KEYS.portalMaintenance,
    label: 'Portal Maintenance',
    description: 'Changes-in-progress window copy, rebuild progress percent, and status footer.',
    surface: 'portal',
  },
  [SITE_CONTENT_KEYS.adminChrome]: {
    key: SITE_CONTENT_KEYS.adminChrome,
    label: 'Admin Chrome',
    description: 'Admin console top bar title, brand label, shortcut hint, and status badge.',
    surface: 'admin',
  },
  [SITE_CONTENT_KEYS.adminHome]: {
    key: SITE_CONTENT_KEYS.adminHome,
    label: 'Admin Overview',
    description: 'Admin overview hero heading, description, and quick navigation actions.',
    surface: 'admin',
  },
  [SITE_CONTENT_KEYS.adminAnalytics]: {
    key: SITE_CONTENT_KEYS.adminAnalytics,
    label: 'Admin Analytics',
    description: 'Analytics dashboard window title and introductory description.',
    surface: 'admin',
  },
};

export interface JsonSchemaObject {
  readonly type?: string | readonly string[];
  readonly format?: string;
  readonly enum?: readonly (string | number | boolean)[];
  readonly const?: string | number | boolean;
  readonly minimum?: number;
  readonly maximum?: number;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly minItems?: number;
  readonly properties?: Readonly<Record<string, JsonSchemaObject>>;
  readonly required?: readonly string[];
  readonly items?: JsonSchemaObject;
  readonly additionalProperties?: boolean | JsonSchemaObject;
  readonly $defs?: Readonly<Record<string, JsonSchemaObject>>;
  readonly $ref?: string;
  readonly anyOf?: readonly JsonSchemaObject[];
  readonly oneOf?: readonly JsonSchemaObject[];
  readonly description?: string;
}

export interface SiteContentValidationIssue {
  readonly path: readonly (string | number)[];
  readonly pathKey: string;
  readonly message: string;
  readonly code: string;
}

export type SiteContentValidationResult =
  | { readonly ok: true; readonly data: Record<string, unknown> }
  | { readonly ok: false; readonly issues: readonly SiteContentValidationIssue[] };

const introspectedSchemaCache = new Map<SiteContentKey, JsonSchemaObject>();

export function isKnownSiteContentKey(key: string): key is SiteContentKey {
  return Object.prototype.hasOwnProperty.call(SITE_CONTENT_SCHEMA_BY_KEY, key);
}

export function formatValidationPathKey(path: readonly (string | number)[]): string {
  return path.map(segment => String(segment)).join('.');
}

export function introspectSiteContentSchema(key: SiteContentKey): JsonSchemaObject {
  const cached = introspectedSchemaCache.get(key);
  if (cached) {
    return cached;
  }
  const schema = SITE_CONTENT_SCHEMA_BY_KEY[key];
  const jsonSchema = z.toJSONSchema(schema, { cycles: 'ref' }) as JsonSchemaObject;
  introspectedSchemaCache.set(key, jsonSchema);
  return jsonSchema;
}

export function validateSiteContentMetadata(
  key: string,
  candidate: Record<string, unknown>,
): SiteContentValidationResult {
  if (!isKnownSiteContentKey(key)) {
    return { ok: true, data: { ...candidate } };
  }

  const parsed = SITE_CONTENT_SCHEMA_BY_KEY[key].safeParse(candidate);
  if (!parsed.success) {
    const issues: SiteContentValidationIssue[] = parsed.error.issues.map(issue => {
      const normalizedPath = issue.path.filter(
        (segment): segment is string | number =>
          typeof segment === 'string' || typeof segment === 'number',
      );
      return {
        path: normalizedPath,
        pathKey: formatValidationPathKey(normalizedPath),
        message: issue.message,
        code: issue.code,
      };
    });
    return { ok: false, issues };
  }

  return {
    ok: true,
    data: { ...candidate, ...parsed.data },
  };
}
