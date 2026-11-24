import type { PortalMenuLoaderData } from '@aklapper/core';
import { loadPortalMenuDataWithPrerender } from '@aklapper/db';
import { type MetaArgs, useLoaderData, useNavigate } from 'react-router';

import { PortalMenuPage } from '#pages/menu';

import { buildPortalPageMeta } from '../seo';

export async function loader(): Promise<PortalMenuLoaderData> {
  return loadPortalMenuDataWithPrerender();
}

export function meta({ loaderData, matches, location }: MetaArgs<typeof loader>) {
  return buildPortalPageMeta({
    matches,
    pathname: location.pathname,
    title: `${loaderData?.content.heading ?? 'Launch Menu'} // andrew-k.us`,
    description:
      loaderData?.content.description ??
      'Select a Solar Forge module to explore CADENCE, RAG Q&A, Agensi skills, and contact workflows.',
  });
}

export default function PortalMenuRoute() {
  const { content, items } = useLoaderData() as PortalMenuLoaderData;
  const navigate = useNavigate();

  return (
    <PortalMenuPage
      content={content}
      items={items}
      onNavigate={to => {
        void navigate(to);
      }}
    />
  );
}
