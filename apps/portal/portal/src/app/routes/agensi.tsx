import type { PortalAgensiLoaderData } from '@aklapper/core';
import { loadPortalAgensiDataWithPrerender } from '@aklapper/db';
import { usePaneNavigation } from '@aklapper/ui';
import { type LoaderFunctionArgs, type MetaArgs, useLoaderData, useNavigate } from 'react-router';

import { PortalAgensiPage } from '#pages/agensi';

import { runPaneSafeLoader, unwrapPaneLoaderData } from '../pane-loader';
import { buildPortalPageMeta } from '../seo';

export async function loader({ request }: LoaderFunctionArgs) {
  return runPaneSafeLoader<PortalAgensiLoaderData>(request, () =>
    loadPortalAgensiDataWithPrerender(),
  );
}

export function meta({ loaderData, matches, location }: MetaArgs<typeof loader>) {
  const resolved = unwrapPaneLoaderData(loaderData);
  return buildPortalPageMeta({
    matches,
    pathname: location.pathname,
    title: 'Agensi Storefront // andrew-k.us',
    description:
      resolved?.content.description ??
      'Published commercial AI agent skills and cloud-native operational blueprints on agensi.io.',
  });
}

export default function PortalAgensiRoute() {
  const { content, skills } = useLoaderData() as PortalAgensiLoaderData;
  const navigate = useNavigate();
  const paneNav = usePaneNavigation();

  return (
    <PortalAgensiPage
      content={content}
      skills={skills}
      onClose={() => {
        if (paneNav?.docked) {
          paneNav.exitTui();
        } else {
          void navigate('/');
        }
      }}
    />
  );
}
