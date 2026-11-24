import type { AdminHomeLoaderData } from '@aklapper/core';
import { loadAdminHomeDataWithPrerender } from '@aklapper/db';
import { type MetaArgs, useLoaderData } from 'react-router';

import { AdminHomePage } from '#pages/home';

import { buildAdminPageMeta } from '../seo';

export async function loader(): Promise<AdminHomeLoaderData> {
  return loadAdminHomeDataWithPrerender();
}

export function meta({ loaderData, matches, location }: MetaArgs<typeof loader>) {
  return buildAdminPageMeta({
    matches,
    pathname: location.pathname,
    title: 'Andrew Klapper Admin',
    description:
      loaderData?.content.description ??
      'Isolated operations console for andrew-k.us passkey auth, CMS, and telemetry.',
  });
}

export default function AdminHomeRoute() {
  const { content, menuItems } = useLoaderData() as AdminHomeLoaderData;
  return <AdminHomePage content={content} menuItems={menuItems} />;
}
