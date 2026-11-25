import type { PortalMenuLoaderData } from '@aklapper/core';

import { PortalMenuPage } from '#pages/menu';

import { type PaneAdapterProps, PaneStreamGate } from '../PaneStreamGate';

export function MenuPaneAdapter({ ctx, deployments }: PaneAdapterProps) {
  return (
    <PaneStreamGate<PortalMenuLoaderData>
      routePath='/menu'
      paneId={ctx.paneId}
      title='Launch Menu'
      loadingLabel='Loading launch menu...'
      onExit={ctx.exitTui}
    >
      {data => (
        <PortalMenuPage
          content={data.content}
          items={data.items}
          deployments={deployments}
          onNavigate={to => {
            if (to === '/') {
              ctx.exitTui();
            } else {
              ctx.push(to);
            }
          }}
        />
      )}
    </PaneStreamGate>
  );
}
