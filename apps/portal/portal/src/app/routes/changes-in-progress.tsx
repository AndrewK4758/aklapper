import type { PortalMaintenanceLoaderData } from '@aklapper/core';
import { loadPortalMaintenanceDataWithPrerender } from '@aklapper/db';
import { type MetaArgs, useLoaderData } from 'react-router';

import { PortalChangesInProgressPage } from '#pages/changes-in-progress';

import { buildPortalPageMeta } from '../seo';

export async function loader(): Promise<PortalMaintenanceLoaderData> {
  return loadPortalMaintenanceDataWithPrerender();
}

export function meta({ loaderData, matches, location }: MetaArgs<typeof loader>) {
  return buildPortalPageMeta({
    matches,
    pathname: location.pathname,
    title: `${loaderData?.content.heading ?? 'Changes in Progress'} // andrew-k.us`,
    description:
      loaderData?.content.lead ??
      'andrew-k.us is being rebuilt into the Solar Forge v2 interactive terminal and TUI platform.',
    robots: 'noindex, nofollow',
  });
}

export default function ChangesInProgressRoute() {
  const data = useLoaderData() as PortalMaintenanceLoaderData;
  return <PortalChangesInProgressPage data={data} />;
}
