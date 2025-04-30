import type { PlayerID, SocketCallback } from '@aklapper/types';
import type { Socket } from 'socket.io';
import useActivePlayersMap from 'src/middleware/use_active_players_map.js';
import Go_WsEventManager from 'src/models/go_websocket_manager.js';
import { lobbySocketServer, socketConnectionMap } from '../main.js';

const handleLeaveLobby: SocketCallback = (event: string, socket: Socket) => {
  socket.on(event, async (playerID: PlayerID) => {
    const activePlayers = useActivePlayersMap();

    const leaveLobbyResponse = await new Go_WsEventManager<boolean, PlayerID>()
      .setEventName('remove-player')
      .setEventHandlerName('deleted-player')
      .setEventData(playerID)
      .setPendingRequestKey(playerID)
      .build();

    if (leaveLobbyResponse) {
      activePlayers.deletePlayerFromLobby(playerID);
      socketConnectionMap.delete(playerID);
    }

    lobbySocketServer.emit('deleted-player', playerID);
  });
};

export default handleLeaveLobby;
