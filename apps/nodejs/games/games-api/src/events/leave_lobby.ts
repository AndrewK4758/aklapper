import type { PlayerID, SocketCallback } from '@aklapper/types';
import type { Socket } from 'socket.io';
import gamesInLobby from 'src/data/games_in_lobby/games_in_lobby.js';
import useActivePlayersMap from 'src/middleware/use_active_players_map.js';
import Go_WsEventManager from 'src/models/go_websocket_manager.js';
import { lobbySocketServer, socketClient, socketConnectionMap } from '../main.js';

const handleLeaveLobby: SocketCallback = (event: string, socket: Socket) => {
  socket.on(event, async (playerID: PlayerID) => {
    const activePlayers = useActivePlayersMap();

    if (socketClient && socketClient.readyState === WebSocket.OPEN) {
      const leaveLobbyResponse = await new Go_WsEventManager<boolean, PlayerID>(socketClient as WebSocket)
        .setEventName('remove-player')
        .setEventHandlerName('deleted-player')
        .setEventData(playerID)
        .setPendingRequestKey(playerID)
        .build();

      if (leaveLobbyResponse) {
        activePlayers.deletePlayerFromLobby(playerID);
        socketConnectionMap.delete(playerID);
      }
    }

    lobbySocketServer.emit('deleted-player', playerID);

    let gameID: string;

    gamesInLobby.games.forEach(game => {
      game.instance.playersArray.forEach(p => {
        if (p.id === playerID) {
          game.instance.playersArray = game.instance.playersArray.filter(p => p.id !== playerID);
        }
      });

      if (game.instance.playersArray.length === 0) {
        gameID = game.gameInstanceID;
        gamesInLobby.games.delete(gameID);
      }
    });
  });
};

export default handleLeaveLobby;
