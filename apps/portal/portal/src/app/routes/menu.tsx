import type { PortalMenuLoaderData } from '@aklapper/core';
import { loadPortalMenuDataWithPrerender } from '@aklapper/db';
import { usePaneNavigation } from '@aklapper/ui';
import { type LoaderFunctionArgs, type MetaArgs, useLoaderData, useNavigate } from 'react-router';

import { PortalMenuPage } from '#pages/menu';

import { useClusterTelemetry } from '../cluster-stream';
import { runPaneSafeLoader, unwrapPaneLoaderData } from '../pane-loader';
import { buildPortalPageMeta } from '../seo';

export async function loader({ request }: LoaderFunctionArgs) {
  return runPaneSafeLoader<PortalMenuLoaderData>(request, () => loadPortalMenuDataWithPrerender());
}

export function meta({ loaderData, matches, location }: MetaArgs<typeof loader>) {
  const resolved = unwrapPaneLoaderData(loaderData);
  return buildPortalPageMeta({
    matches,
    pathname: location.pathname,
    title: `${resolved?.content.heading ?? 'Launch Menu'} // andrew-k.us`,
    description:
      resolved?.content.description ??
      'Select a Solar Forge module to explore CADENCE, RAG Q&A, Agensi skills, and contact workflows.',
  });
}

export default function PortalMenuRoute() {
  const { content, items } = useLoaderData() as PortalMenuLoaderData;
  const cluster = useClusterTelemetry();
  const navigate = useNavigate();
  const paneNav = usePaneNavigation();

  return (
    <PortalMenuPage
      content={content}
      items={items}
      deployments={cluster.deployments}
      onNavigate={to => {
        if (paneNav?.docked) {
          if (to === '/') {
            paneNav.exitTui();
          } else {
            paneNav.push(to);
          }
        } else {
          void navigate(to);
        }
      }}
    />
  );
}
