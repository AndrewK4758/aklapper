import type { InstanceOfGame } from '@aklapper/models';
import type { GameInsanceLobbyData, WsEvent, WsResponse } from '@aklapper/types';
import { pendingRequests } from 'src/data/promise_callback_map/promise_callback_map.js';
import { socketClient } from 'src/main.js';
import go_websocketEvent from 'src/models/go-websocket_event.js';

export default async function go_NewGame(newGame: InstanceOfGame, gameId: string): Promise<WsResponse> {
  return new Promise((resolve, reject) => {
    pendingRequests.set(gameId, { resolve, reject });

    const eventData: GameInsanceLobbyData = {
      gameInstanceID: gameId,
      gameName: newGame.instance.instance.NAME,
      inLobby: true,
      playersArray: newGame.instance.playersArray.map(player => player.prepareJsonPlayerToSend()),
    };

    const newGameEvent: WsEvent = {
      event: 'new-game',
      data: eventData,
    };

    socketClient.onmessage = async (event: MessageEvent) => await go_websocketEvent(event, 'game-added');

    socketClient.send(JSON.stringify(newGameEvent));
  });
}
