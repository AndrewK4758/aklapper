import type { WsEvent, WsResponse } from '@aklapper/types';
import { pendingRequests, type PromiseCallbackMap } from 'src/data/promise_callback_map/promise_callback_map.js';

/**
 *   FIGURE OUT WHERE I WANT TO HANDLE THE REJECT? HERE OR IN THE FUNCTION CALLING THIS EVENT HANDLER
 */

export default async function go_websocketEvent<T>(
  event: MessageEvent,
  eventHandlerName: string,
  key?: string,
): Promise<void> {
  const parsedMessageData: WsEvent = JSON.parse(event.data);

  if (parsedMessageData) {
    const { event, data } = parsedMessageData;

    if (event === eventHandlerName) {
      const { status, response, event } = data as WsResponse<T>;

      const { resolve, reject } = pendingRequests.get(key ?? event) as PromiseCallbackMap<T>;

      if (status === 'success') {
        resolve(response);
        pendingRequests.delete(event);
      }

      reject(data as T);
      pendingRequests.delete(event);
    }
  }
}
