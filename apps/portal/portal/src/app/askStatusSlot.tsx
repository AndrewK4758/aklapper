import type { AskServiceStatus, PortalAskContent, StreamResult } from '@aklapper/core';
import { OscStatusBadge, SuspenseElement } from '@aklapper/ui';
import type { ReactNode } from 'react';

import { resolveAskBadgeStatus } from '#pages/ask';

import { reportPortalPublicError } from './client-telemetry';

export interface CreateAskStatusSlotOptions {
  readonly content: PortalAskContent;
  readonly askStatusPayload: Promise<StreamResult<AskServiceStatus | undefined>>;
  readonly correlationId: string;
  readonly pathname?: string;
}

export function createAskStatusSlot({
  content,
  askStatusPayload,
  correlationId,
  pathname = '/ask',
}: CreateAskStatusSlotOptions): ReactNode {
  return (
    <SuspenseElement<AskServiceStatus | undefined>
      resolve={askStatusPayload}
      correlationId={correlationId}
      homeHref=''
      loading={
        <OscStatusBadge
          source={content.statusBadge.source}
          state='scaling'
          label='probing · ai-ask'
        />
      }
      onStreamError={error => {
        reportPortalPublicError(error, { phase: 'stream', pathname });
        console.error(
          JSON.stringify({
            event: 'portal.pane_nav.ask_status_stream_error',
            pathname,
            code: error.code,
            correlationId: error.correlationId,
          }),
        );
      }}
      errorElement={() => (
        <OscStatusBadge
          source={content.statusBadge.source}
          state='error'
          label='offline · status unavailable'
        />
      )}
    >
      {askStatus => {
        const badge = resolveAskBadgeStatus(content, false, null, askStatus);
        return (
          <OscStatusBadge
            source={content.statusBadge.source}
            state={badge.state}
            label={badge.label}
          />
        );
      }}
    </SuspenseElement>
  );
}
