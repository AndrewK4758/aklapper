import type { PortalAgensiLoaderData } from '@aklapper/core';

import { PortalAgensiPage } from '#pages/agensi';

import { type PaneAdapterProps, PaneStreamGate } from '../PaneStreamGate';

export function AgensiPaneAdapter({ ctx }: PaneAdapterProps) {
  return (
    <PaneStreamGate<PortalAgensiLoaderData>
      routePath='/agensi'
      paneId={ctx.paneId}
      title='Agensi Storefront'
      loadingLabel='Loading Agensi storefront...'
      onExit={ctx.exitTui}
    >
      {data => (
        <PortalAgensiPage
          content={data.content}
          skills={data.skills}
          catalogMeta={data.catalogMeta}
          onClose={ctx.exitTui}
        />
      )}
    </PaneStreamGate>
  );
}
