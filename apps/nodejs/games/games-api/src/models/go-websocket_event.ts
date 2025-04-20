import type { WsEvent, WsResponse } from '@aklapper/types';
import { pendingRequests, type PromiseCallbackMap } from 'src/data/promise_callback_map/promise_callback_map.js';

export default async function go_websocketEvent(event: MessageEvent, eventName: string): Promise<void> {
  const parsedMessageData: WsEvent = JSON.parse(event.data);

  if (parsedMessageData) {
    const { event, data } = parsedMessageData;

    if (event === eventName) {
      const { status, response } = data as WsResponse;

      const { resolve, reject } = pendingRequests.get(response as string) as PromiseCallbackMap;

      return status === 'success' ? resolve(data as WsResponse) : reject(data);
    }
  }
}
