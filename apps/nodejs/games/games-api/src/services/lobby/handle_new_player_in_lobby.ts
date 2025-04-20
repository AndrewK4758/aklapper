import type { IPlayerClientData, WsEvent, WsResponse } from '@aklapper/types';
import { pendingRequests } from 'src/data/promise_callback_map/promise_callback_map.js';
import { socketClient } from 'src/main.js';
import go_websocketEvent from 'src/models/go-websocket_event.js';

export default async function go_AddPlayerToLobby(event: string, eventData: IPlayerClientData): Promise<WsResponse> {
  return new Promise((resolve, reject) => {
    const playerId = eventData.id as string;

    pendingRequests.set(playerId, { resolve, reject });

    const newPlayerEvent: WsEvent = {
      event: event,
      data: eventData,
    };

    socketClient.onmessage = async (event: MessageEvent) => await go_websocketEvent(event, 'player-added');

    socketClient.send(JSON.stringify(newPlayerEvent));
  });
}
