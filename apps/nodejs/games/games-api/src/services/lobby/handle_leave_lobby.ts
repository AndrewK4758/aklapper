import type { WsEvent, WsResponse } from '@aklapper/types';
import { pendingRequests } from 'src/data/promise_callback_map/promise_callback_map.js';
import { socketClient } from 'src/main.js';
import go_websocketEvent from 'src/models/go-websocket_event.js';

export default async function go_leaveLobby(event: string, playerId: string): Promise<WsResponse> {
  return new Promise((resolve, reject) => {
    pendingRequests.set(playerId, { resolve, reject });

    const removePlayerEvent: WsEvent = {
      event: event,
      data: playerId,
    };
    //
    socketClient.onmessage = async (event: MessageEvent) => await go_websocketEvent(event, 'deleted-player');
    //
    socketClient.send(JSON.stringify(removePlayerEvent));
  });
}
