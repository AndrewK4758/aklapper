import type { PortalAgensiLoaderData } from '@aklapper/core';
import { loadPortalAgensiDataWithPrerender } from '@aklapper/db';
import { type MetaArgs, useLoaderData, useNavigate } from 'react-router';

import { PortalAgensiPage } from '#pages/agensi';

import { buildPortalPageMeta } from '../seo';

export async function loader(): Promise<PortalAgensiLoaderData> {
  return loadPortalAgensiDataWithPrerender();
}

export function meta({ loaderData, matches, location }: MetaArgs<typeof loader>) {
  return buildPortalPageMeta({
    matches,
    pathname: location.pathname,
    title: 'Agensi Storefront // andrew-k.us',
    description:
      loaderData?.content.description ??
      'Published commercial AI agent skills and cloud-native operational blueprints on agensi.io.',
  });
}

export default function PortalAgensiRoute() {
  const { content, skills } = useLoaderData() as PortalAgensiLoaderData;
  const navigate = useNavigate();

  return (
    <PortalAgensiPage
      content={content}
      skills={skills}
      onClose={() => {
        void navigate('/');
      }}
    />
  );
}
