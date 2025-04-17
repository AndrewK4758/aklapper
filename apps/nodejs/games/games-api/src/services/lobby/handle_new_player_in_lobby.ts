import type { IPlayer, WsEvent, WsResponse } from '@aklapper/types';
import { pendingRequests, type PromiseCallbackMap } from 'src/data/promise_callback_map/promise_callback_map.js';
import { socketClient } from 'src/main.js';

export default async function go_AddPlayerToLobby(event: string, eventData: Partial<IPlayer>): Promise<string> {
  return new Promise((resolve, reject) => {
    const playerId = eventData.id as string;

    pendingRequests.set(playerId, { resolve, reject });

    const newPlayerEvent: WsEvent = {
      event: event,
      data: eventData,
    };

    socketClient.onmessage = (event: MessageEvent) => {
      const parsedMessageData: WsEvent = JSON.parse(event.data);
      if (parsedMessageData) {
        const { event, data } = parsedMessageData;

        if (event === 'player-added') {
          const { status, response } = data as WsResponse;

          const { resolve, reject } = pendingRequests.get(response as string) as PromiseCallbackMap;

          return status === 'success' ? resolve(response as string) : reject('Error adding player to lobby');
        }
      }
    };

    socketClient.send(JSON.stringify(newPlayerEvent));
  });
}
