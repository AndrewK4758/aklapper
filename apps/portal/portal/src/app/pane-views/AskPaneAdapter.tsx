import type { PortalAskLoaderData } from '@aklapper/core';
import { href, useFetcher } from 'react-router';

import { type PortalAskActionResult, PortalAskPage } from '#pages/ask';

import { createAskStatusSlot } from '../askStatusSlot';
import { reportPortalClientError } from '../client-telemetry';
import { isAskStreamLoaderEnvelope, isStreamLoaderEnvelope } from '../pane-loader';
import { emitPaneTelemetryOnce, type PaneAdapterProps, PaneStreamGate } from '../PaneStreamGate';

export function AskPaneAdapter({ ctx }: PaneAdapterProps) {
  const submitFetcher = useFetcher<PortalAskActionResult>();
  return (
    <PaneStreamGate<PortalAskLoaderData>
      routePath='/ask'
      paneId={ctx.paneId}
      title='Ask Portfolio'
      loadingLabel='Loading portfolio Q&A...'
      onExit={ctx.exitTui}
    >
      {(data, rawEnvelope) => {
        let askStatusSlot = undefined;
        if (isAskStreamLoaderEnvelope(rawEnvelope)) {
          askStatusSlot = createAskStatusSlot({
            content: data.content,
            askStatusPayload: rawEnvelope.askStatusPayload,
            correlationId: rawEnvelope.correlationId,
          });
        } else if (isStreamLoaderEnvelope(rawEnvelope)) {
          emitPaneTelemetryOnce(`ask-envelope-mismatch:${ctx.paneId}`, () => {
            console.error(
              JSON.stringify({
                event: 'portal.pane_nav.envelope_shape_mismatch',
                routePath: '/ask',
                paneId: ctx.paneId,
                correlationId: rawEnvelope.correlationId,
              }),
            );
            reportPortalClientError(
              new Error('Ask pane loader envelope missing askStatusPayload stream.'),
              {
                phase: 'boundary',
                pathname: '/ask',
                errorCode: 'ERR_UPSTREAM_UNAVAILABLE',
              },
            );
          });
        }

        return (
          <PortalAskPage
            content={data.content}
            quota={data.quota}
            askStatus={data.askStatus}
            askStatusSlot={askStatusSlot}
            actionResult={submitFetcher.data}
            isSubmitting={submitFetcher.state !== 'idle'}
            onSubmitAsk={({ mode, text, attemptId }) => {
              void submitFetcher.submit(
                { mode, text, attemptId },
                { method: 'post', action: href('/ask') },
              );
            }}
            onClose={ctx.exitTui}
          />
        );
      }}
    </PaneStreamGate>
  );
}
