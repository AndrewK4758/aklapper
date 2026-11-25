import type { ContactActionResult, PortalContactLoaderData } from '@aklapper/core';
import { href, useFetcher } from 'react-router';

import { PortalContactPage } from '#pages/contact';

import { type PaneAdapterProps, PaneStreamGate } from '../PaneStreamGate';

export function ContactPaneAdapter({ ctx }: PaneAdapterProps) {
  const submitFetcher = useFetcher<ContactActionResult>();
  return (
    <PaneStreamGate<PortalContactLoaderData>
      routePath='/contact'
      paneId={ctx.paneId}
      title='Contact'
      loadingLabel='Loading contact channel...'
      onExit={ctx.exitTui}
    >
      {data => (
        <PortalContactPage
          content={data.content}
          actionData={submitFetcher.data}
          isSubmitting={submitFetcher.state !== 'idle'}
          formAction={href('/contact')}
          onClose={ctx.exitTui}
          renderFormElement={({ action, className, onSubmit, children }) => (
            <submitFetcher.Form
              action={action}
              method='post'
              encType='multipart/form-data'
              noValidate
              className={className}
              onSubmit={onSubmit}
            >
              {children}
            </submitFetcher.Form>
          )}
        />
      )}
    </PaneStreamGate>
  );
}
