import type { PortalRootLoaderData } from '@aklapper/contracts';
import { buildRouteMetaTags, type SeoMetaDescriptor } from '@aklapper/shared-utils';

export const DEFAULT_PORTAL_SITE_URL = 'https://andrew-k.us';
export const PORTAL_SITE_NAME = 'andrew-k.us';

interface RouteMatchLike {
  id: string;
  loaderData?: unknown;
  data?: unknown;
}

export function getPortalRootDataFromMatches(
  matches: readonly (RouteMatchLike | undefined)[],
): PortalRootLoaderData | undefined {
  const rootMatch = matches.find(match => match?.id === 'root');
  return (rootMatch?.loaderData ?? rootMatch?.data) as PortalRootLoaderData | undefined;
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
  const isMaintenance = Boolean(rootData?.maintenanceMode);

  if (isMaintenance) {
    return buildRouteMetaTags({
      title: rootData?.maintenance?.content.heading
        ? `${rootData.maintenance.content.heading} // ${PORTAL_SITE_NAME}`
        : `Changes in Progress // ${PORTAL_SITE_NAME}`,
      description:
        rootData?.maintenance?.content.lead ??
        'andrew-k.us is being rebuilt into the Solar Forge v2 interactive terminal and TUI platform.',
      siteName: PORTAL_SITE_NAME,
      siteUrl,
      pathname: options.pathname,
      robots: 'noindex, nofollow',
    });
  }

  return buildRouteMetaTags({
    title: options.title,
    description: options.description,
    siteName: PORTAL_SITE_NAME,
    siteUrl,
    pathname: options.pathname,
    robots: options.robots ?? 'index, follow',
  });
}
