import type { ContactActionResult, PortalContactLoaderData } from '@aklapper/core';
import type { TerminalPaneViewContext } from '@aklapper/ui';
import type { JSX } from 'react';
import { href, useNavigation } from 'react-router';

import { type PortalContactFormRenderProps, PortalContactPage } from '#pages/contact';

import type { StreamLoaderEnvelope } from '../pane-loader';
import {
  FeatureStreamBoundary,
  usePaneActionSubmit,
  usePortalPaneStream,
  usePrimaryRouteClose,
} from './FeatureStreamBoundary';

export interface ContactFeatureViewProps {
  readonly mode: 'route' | 'pane';
  readonly paneId?: string;
  readonly loaderData: StreamLoaderEnvelope<PortalContactLoaderData>;
  readonly actionData?: ContactActionResult;
  readonly isSubmitting: boolean;
  readonly retryNonce?: number;
  readonly isRetrying?: boolean;
  readonly onRetry?: () => void;
  readonly onClose: () => void;
  readonly renderFormElement?: (props: PortalContactFormRenderProps) => JSX.Element;
}

export function ContactFeatureView({
  mode,
  paneId,
  loaderData,
  actionData,
  isSubmitting,
  retryNonce,
  isRetrying,
  onRetry,
  onClose,
  renderFormElement,
}: ContactFeatureViewProps) {
  return (
    <FeatureStreamBoundary<PortalContactLoaderData>
      mode={mode}
      routePath='/contact'
      paneId={paneId}
      title='Contact'
      loadingLabel='Loading contact channel...'
      correlationId={loaderData.correlationId}
      resolve={loaderData.payload}
      retryNonce={retryNonce}
      isRetrying={isRetrying}
      onRetry={onRetry}
      onExit={onClose}
    >
      {({ content }) => (
        <PortalContactPage
          content={content}
          actionData={actionData}
          isSubmitting={isSubmitting}
          formAction={href('/contact')}
          onClose={onClose}
          renderFormElement={renderFormElement}
        />
      )}
    </FeatureStreamBoundary>
  );
}

export function ContactRouteView({
  loaderData,
  actionData,
}: {
  readonly loaderData: StreamLoaderEnvelope<PortalContactLoaderData>;
  readonly actionData?: ContactActionResult;
}) {
  const navigation = useNavigation();
  const onClose = usePrimaryRouteClose();
  const isSubmitting =
    navigation.state === 'submitting' && navigation.formAction === href('/contact');

  return (
    <ContactFeatureView
      mode='route'
      loaderData={loaderData}
      actionData={actionData}
      isSubmitting={isSubmitting}
      onClose={onClose}
    />
  );
}

export function ContactPaneView({ ctx }: { readonly ctx: TerminalPaneViewContext }) {
  const { entry, retry } = usePortalPaneStream<PortalContactLoaderData>(ctx.paneId, '/contact');
  const paneSubmit = usePaneActionSubmit<ContactActionResult>('/contact');

  return (
    <ContactFeatureView
      mode='pane'
      paneId={ctx.paneId}
      loaderData={{ correlationId: entry.correlationId, payload: entry.payload }}
      actionData={paneSubmit.actionData}
      isSubmitting={paneSubmit.isSubmitting}
      retryNonce={entry.retryNonce}
      isRetrying={entry.status === 'loading' && entry.retryNonce > 0}
      onRetry={retry}
      onClose={ctx.exitTui}
      renderFormElement={({ action, className, onSubmit, children }) => (
        <form
          action={action}
          method='post'
          encType='multipart/form-data'
          noValidate
          className={className}
          onSubmit={event => {
            onSubmit(event);
            if (event.defaultPrevented) return;
            event.preventDefault();
            paneSubmit.submit(new FormData(event.currentTarget));
          }}
        >
          {children}
        </form>
      )}
    />
  );
}
