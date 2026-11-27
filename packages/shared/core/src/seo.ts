import type { DocumentSeoRuntimeConfig } from './portal.ts';

const GA4_ID_PATTERN = /^G-[A-Z0-9]+$/i;
const GTM_ID_PATTERN = /^GTM-[A-Z0-9]+$/i;
const GSC_TOKEN_PATTERN = /^[A-Za-z0-9._-]+$/;

export type SeoMetaDescriptor =
  | { title: string }
  | { name: string; content: string }
  | { property: string; content: string };

export interface ReadSeoRuntimeConfigOptions {
  defaultSiteUrl: string;
  siteUrlEnvKey?: string;
  defaultAnalyticsEndpoint?: string;
  env?: Record<string, string | undefined>;
}

export interface RouteSeoMetaOptions {
  title: string;
  description: string;
  siteName: string;
  siteUrl: string;
  pathname: string;
  robots?: string;
  ogType?: 'website' | 'article' | 'profile';
  ogImagePath?: string;
  twitterCard?: 'summary' | 'summary_large_image';
  locale?: string;
}

const SLASH_CHAR_CODE = 47;

export function trimTrailingSlashes(value: string): string {
  let end = value.length;
  while (end > 0 && value.charCodeAt(end - 1) === SLASH_CHAR_CODE) {
    end -= 1;
  }
  return end === value.length ? value : value.slice(0, end);
}

export function normalizePathname(pathname: string): string {
  const trimmed = trimTrailingSlashes(pathname);
  return trimmed.length > 0 ? trimmed : '/';
}

function normalizeBaseUrl(rawUrl: string | undefined, fallback: string): string {
  const candidate = rawUrl?.trim();
  if (!candidate) return trimTrailingSlashes(fallback);
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.origin;
    }
  } catch {
    return trimTrailingSlashes(fallback);
  }
  return trimTrailingSlashes(fallback);
}

function normalizeEndpointUrl(rawUrl: string | undefined): string | undefined {
  const candidate = rawUrl?.trim();
  if (!candidate) return undefined;
  if (candidate.startsWith('/')) return candidate;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function matchPattern(raw: string | undefined, pattern: RegExp): string | undefined {
  const trimmed = raw?.trim();
  if (!trimmed || !pattern.test(trimmed)) return undefined;
  return trimmed;
}

export const DEFAULT_ANALYTICS_ENDPOINT = '/api/analytics/ingest';

export function readSeoRuntimeConfig(
  options: ReadSeoRuntimeConfigOptions,
): DocumentSeoRuntimeConfig {
  const env = options.env ?? (typeof process !== 'undefined' ? process.env : {});
  const specificSiteUrl = options.siteUrlEnvKey ? env[options.siteUrlEnvKey] : undefined;
  const siteUrl = normalizeBaseUrl(
    specificSiteUrl ?? env['PUBLIC_SITE_URL'],
    options.defaultSiteUrl,
  );
  const rawAnalyticsEndpoint = env['PUBLIC_ANALYTICS_ENDPOINT'];
  const analyticsEndpoint =
    rawAnalyticsEndpoint === undefined || rawAnalyticsEndpoint.trim() === ''
      ? normalizeEndpointUrl(options.defaultAnalyticsEndpoint ?? DEFAULT_ANALYTICS_ENDPOINT)
      : normalizeEndpointUrl(rawAnalyticsEndpoint);
  const gaMeasurementId = matchPattern(env['PUBLIC_GA_MEASUREMENT_ID'], GA4_ID_PATTERN);
  const gtmId = matchPattern(env['PUBLIC_GTM_ID'], GTM_ID_PATTERN);
  const gscVerification = matchPattern(env['PUBLIC_GSC_VERIFICATION'], GSC_TOKEN_PATTERN);

  return {
    siteUrl,
    ...(analyticsEndpoint ? { analyticsEndpoint } : {}),
    ...(gaMeasurementId ? { gaMeasurementId } : {}),
    ...(gtmId ? { gtmId } : {}),
    ...(gscVerification ? { gscVerification } : {}),
  };
}

export function buildCanonicalUrl(siteUrl: string, pathname: string): string {
  const base = trimTrailingSlashes(siteUrl);
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const cleanPath = normalizePathname(normalizedPath);
  return `${base}${cleanPath}`;
}

export function resolveOrigin(url: string | undefined): string | undefined {
  if (!url || url.startsWith('/')) return undefined;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.origin : undefined;
  } catch {
    return undefined;
  }
}

export function buildRouteMetaTags(options: RouteSeoMetaOptions): SeoMetaDescriptor[] {
  const {
    title,
    description,
    siteName,
    siteUrl,
    pathname,
    robots = 'index, follow',
    ogType = 'website',
    ogImagePath = '/favicon.svg',
    twitterCard = 'summary',
    locale = 'en_US',
  } = options;

  const canonicalUrl = buildCanonicalUrl(siteUrl, pathname);
  const imageUrl = buildCanonicalUrl(siteUrl, ogImagePath);

  return [
    { title },
    { name: 'description', content: description },
    { name: 'robots', content: robots },
    { property: 'og:type', content: ogType },
    { property: 'og:site_name', content: siteName },
    { property: 'og:locale', content: locale },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:url', content: canonicalUrl },
    { property: 'og:image', content: imageUrl },
    { name: 'twitter:card', content: twitterCard },
    { name: 'twitter:title', content: title },
    { name: 'twitter:description', content: description },
    { name: 'twitter:image', content: imageUrl },
  ];
}

export function buildPortalJsonLd(siteUrl: string): Record<string, unknown> {
  const base = trimTrailingSlashes(siteUrl);
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${base}/#website`,
        url: `${base}/`,
        name: 'andrew-k.us // Solar Forge Terminal',
        description:
          'Interactive portfolio terminal, CADENCE sandboxed artifact builder, and GKE Autopilot scale-from-zero showcase by Andrew Klapper.',
        inLanguage: 'en-US',
      },
      {
        '@type': 'Person',
        '@id': `${base}/#person`,
        name: 'Andrew Klapper',
        alternateName: 'aklapper',
        url: `${base}/`,
        sameAs: ['https://agensi.io/creators/aklapper'],
        jobTitle: 'Principal Full-Stack & Agentic Systems Engineer',
      },
    ],
  };
}

export function serializeJsonLd(data: Record<string, unknown>): string {
  return JSON.stringify(data).replaceAll('<', '\\u003c');
}

export interface RouteMatchLike {
  id: string;
  loaderData?: unknown;
  data?: unknown;
}

export function getRootDataFromMatches<T>(
  matches: readonly (RouteMatchLike | undefined)[],
): T | undefined {
  const rootMatch = matches.find(match => match?.id === 'root');
  return (rootMatch?.loaderData ?? rootMatch?.data) as T | undefined;
}
