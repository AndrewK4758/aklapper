import type { AskMode, PortalAskLoaderData } from '@aklapper/core';
import type { TerminalPaneViewContext } from '@aklapper/ui';
import type { ReactNode } from 'react';
import { href, useFetcher } from 'react-router';

import { type PortalAskActionResult, PortalAskPage } from '#pages/ask';

import { createAskStatusSlot } from '../askStatusSlot';
import { reportPortalClientError } from '../client-telemetry';
import {
  type AskStreamLoaderEnvelope,
  isAskStreamLoaderEnvelope,
  isStreamLoaderEnvelope,
  type StreamLoaderEnvelope,
} from '../pane-loader';
import { emitPaneTelemetryOnce } from '../workspace/portalPaneStreamStore';
import {
  FeatureStreamBoundary,
  usePaneActionSubmit,
  usePortalPaneStream,
  usePrimaryRouteClose,
} from './FeatureStreamBoundary';

interface ChatFeatureBodyProps {
  readonly mode: 'route' | 'pane';
  readonly instanceId: string;
  readonly paneId?: string;
  readonly loaderData: StreamLoaderEnvelope<PortalAskLoaderData> | AskStreamLoaderEnvelope;
  readonly rawEnvelope?: unknown;
  readonly retryNonce?: number;
  readonly isRetrying?: boolean;
  readonly onRetry?: () => void;
  readonly actionResult: PortalAskActionResult | undefined;
  readonly isSubmitting: boolean;
  readonly onSubmitAsk: (payload: { mode: AskMode; text: string; attemptId: string }) => void;
  readonly onClose: () => void;
}

function resolveAskStatusSlot(
  content: PortalAskLoaderData['content'],
  rawEnvelope: unknown,
  paneId?: string,
): ReactNode {
  if (isAskStreamLoaderEnvelope(rawEnvelope)) {
    return createAskStatusSlot({
      content,
      askStatusPayload: rawEnvelope.askStatusPayload,
      correlationId: rawEnvelope.correlationId,
    });
  }
  if (paneId && isStreamLoaderEnvelope(rawEnvelope)) {
    emitPaneTelemetryOnce(`ask-envelope-mismatch:${paneId}`, () => {
      console.error(
        JSON.stringify({
          event: 'portal.pane_nav.envelope_shape_mismatch',
          seamType: 'BOUNDARY_FAULT',
          routePath: '/chat',
          paneId,
          correlationId: rawEnvelope.correlationId,
        }),
      );
      reportPortalClientError(
        new Error('Ask pane loader envelope missing askStatusPayload stream.'),
        {
          phase: 'boundary',
          pathname: '/chat',
          errorCode: 'ERR_UPSTREAM_UNAVAILABLE',
        },
      );
    });
  }
  return undefined;
}

export function ChatFeatureView({
  mode,
  instanceId,
  paneId,
  loaderData,
  rawEnvelope,
  retryNonce,
  isRetrying,
  onRetry,
  actionResult,
  isSubmitting,
  onSubmitAsk,
  onClose,
}: ChatFeatureBodyProps) {
  return (
    <FeatureStreamBoundary<PortalAskLoaderData>
      mode={mode}
      routePath='/chat'
      paneId={paneId}
      title='Chat with Andrew'
      loadingLabel='Loading Chat with Andrew...'
      correlationId={loaderData.correlationId}
      resolve={loaderData.payload}
      retryNonce={retryNonce}
      isRetrying={isRetrying}
      onRetry={onRetry}
      onExit={onClose}
    >
      {({ content, quota, askStatus }) => (
        <PortalAskPage
          instanceId={instanceId}
          content={content}
          quota={quota}
          askStatus={askStatus}
          askStatusSlot={resolveAskStatusSlot(content, rawEnvelope ?? loaderData, paneId)}
          streamEndpoint={href('/api/ask/stream')}
          actionResult={actionResult}
          isSubmitting={isSubmitting}
          onSubmitAsk={onSubmitAsk}
          onClose={onClose}
        />
      )}
    </FeatureStreamBoundary>
  );
}

export function ChatRouteView({ loaderData }: { readonly loaderData: AskStreamLoaderEnvelope }) {
  const fetcher = useFetcher<PortalAskActionResult>();
  const onClose = usePrimaryRouteClose();

  return (
    <ChatFeatureView
      mode='route'
      instanceId='primary:/chat'
      loaderData={loaderData}
      rawEnvelope={loaderData}
      actionResult={fetcher.data}
      isSubmitting={fetcher.state !== 'idle'}
      onSubmitAsk={({ mode, text, attemptId }) => {
        void fetcher.submit({ mode, text, attemptId }, { method: 'post', action: href('/chat') });
      }}
      onClose={onClose}
    />
  );
}

export function ChatPaneView({ ctx }: { readonly ctx: TerminalPaneViewContext }) {
  const { entry, retry } = usePortalPaneStream<PortalAskLoaderData>(ctx.paneId, '/chat');
  const paneSubmit = usePaneActionSubmit<PortalAskActionResult>('/chat');

  return (
    <ChatFeatureView
      mode='pane'
      instanceId={`pane:${ctx.paneId}`}
      paneId={ctx.paneId}
      loaderData={{ correlationId: entry.correlationId, payload: entry.payload }}
      rawEnvelope={entry.envelope}
      retryNonce={entry.retryNonce}
      isRetrying={entry.status === 'loading' && entry.retryNonce > 0}
      onRetry={retry}
      actionResult={paneSubmit.actionData}
      isSubmitting={paneSubmit.isSubmitting}
      onSubmitAsk={({ mode, text, attemptId }) => {
        const formData = new FormData();
        formData.set('mode', mode);
        formData.set('text', text);
        formData.set('attemptId', attemptId);
        paneSubmit.submit(formData);
      }}
      onClose={ctx.exitTui}
    />
  );
}
