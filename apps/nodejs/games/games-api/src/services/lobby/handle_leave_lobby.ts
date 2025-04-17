import type { WsEvent, WsResponse } from '@aklapper/types';
import { pendingRequests, type PromiseCallbackMap } from 'src/data/promise_callback_map/promise_callback_map.js';
import { socketClient } from 'src/main.js';

export default async function go_leaveLobby(event: string, playerId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    pendingRequests.set(playerId, { resolve, reject });

    const removePlayerEvent: WsEvent = {
      event: event,
      data: playerId,
    };

    socketClient.onmessage = (event: MessageEvent) => {
      console.log(event.data);
      const parsedMessageData = JSON.parse(event.data) as WsEvent;

      if (parsedMessageData) {
        const { event, data } = parsedMessageData;

        console.log(event, data);
        if (event === 'deleted-player') {
          const { status, response } = data as WsResponse;

          const { resolve, reject } = pendingRequests.get(playerId as string) as PromiseCallbackMap;

          return status === 'success' ? resolve(response as string) : reject(`error deleting player id: ${response}`);
        }
      }
    };

    socketClient.send(JSON.stringify(removePlayerEvent));
  });
}
