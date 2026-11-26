import {
  buildRouteMetaTags,
  type DocumentSeoRuntimeConfig,
  getRootDataFromMatches,
  type RouteMatchLike,
  type SeoMetaDescriptor,
} from '@aklapper/core';

export const DEFAULT_PORTAL_SITE_URL = 'https://andrew-k.us';
export const PORTAL_SITE_NAME = 'andrew-k.us';

export interface PortalRootSyncSeoData {
  readonly runtimeSeo?: DocumentSeoRuntimeConfig;
}

export function getPortalRootDataFromMatches(
  matches: readonly (RouteMatchLike | undefined)[],
): PortalRootSyncSeoData | undefined {
  return getRootDataFromMatches<PortalRootSyncSeoData>(matches);
}

export function buildPortalPageMeta(options: {
  matches: readonly (RouteMatchLike | undefined)[];
  pathname: string;
  title: string;
  description: string;
  robots?: string;
}): SeoMetaDescriptor[] {
  const rootData = getPortalRootDataFromMatches(options.matches);
  const siteUrl = rootData?.runtimeSeo?.siteUrl ?? DEFAULT_PORTAL_SITE_URL;

  return buildRouteMetaTags({
    title: options.title,
    description: options.description,
    siteName: PORTAL_SITE_NAME,
    siteUrl,
    pathname: options.pathname,
    robots: options.robots ?? 'index, follow',
  });
}
