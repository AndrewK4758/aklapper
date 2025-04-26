import type { WsEvent } from '@aklapper/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function buildWsEvent(eventName: string, eventData: any): WsEvent {
  return {
    event: eventName,
    data: eventData,
  };
}
