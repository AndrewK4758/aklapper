import {
  buildRouteMetaTags,
  type DocumentSeoRuntimeConfig,
  getRootDataFromMatches,
  type RouteMatchLike,
  type SeoMetaDescriptor,
} from '@aklapper/core';

export const DEFAULT_ADMIN_SITE_URL = 'https://admin.andrew-k.us';
export const ADMIN_SITE_NAME = 'admin.andrew-k.us';
export const ADMIN_ROBOTS_DIRECTIVE = 'noindex, nofollow, noarchive';

export interface AdminRootSyncSeoData {
  readonly runtimeSeo?: DocumentSeoRuntimeConfig;
}

export function getAdminRootDataFromMatches(
  matches: readonly (RouteMatchLike | undefined)[],
): AdminRootSyncSeoData | undefined {
  return getRootDataFromMatches<AdminRootSyncSeoData>(matches);
}

export function buildAdminPageMeta(options: {
  matches: readonly (RouteMatchLike | undefined)[];
  pathname: string;
  title: string;
  description: string;
}): SeoMetaDescriptor[] {
  const rootData = getAdminRootDataFromMatches(options.matches);
  const siteUrl = rootData?.runtimeSeo?.siteUrl ?? DEFAULT_ADMIN_SITE_URL;

  return buildRouteMetaTags({
    title: options.title,
    description: options.description,
    siteName: ADMIN_SITE_NAME,
    siteUrl,
    pathname: options.pathname,
    robots: ADMIN_ROBOTS_DIRECTIVE,
  });
}
