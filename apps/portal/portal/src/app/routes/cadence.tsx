import type { PortalCadenceLoaderData } from '@aklapper/core';
import { loadPortalCadenceDataWithPrerender } from '@aklapper/db';
import { type MetaArgs, useLoaderData, useNavigate } from 'react-router';

import { PortalCadencePage } from '#pages/cadence';

import { buildPortalPageMeta } from '../seo';

export async function loader(): Promise<PortalCadenceLoaderData> {
  return loadPortalCadenceDataWithPrerender();
}

export function meta({ loaderData, matches, location }: MetaArgs<typeof loader>) {
  return buildPortalPageMeta({
    matches,
    pathname: location.pathname,
    title: 'CADENCE Builder // andrew-k.us',
    description:
      loaderData?.content.description ??
      'Quota-gated prompt-to-artifact sandbox wired for live GKE Autopilot scale-from-zero execution.',
  });
}

export default function PortalCadenceRoute() {
  const { content, presets } = useLoaderData() as PortalCadenceLoaderData;
  const navigate = useNavigate();

  return (
    <PortalCadencePage
      content={content}
      presets={presets}
      onClose={() => {
        void navigate('/');
      }}
    />
  );
}
