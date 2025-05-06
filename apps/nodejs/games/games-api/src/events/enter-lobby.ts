import { Player } from '@aklapper/games-components';
import type { IPlayerClientData, SocketCallback } from '@aklapper/types';
import type { Socket } from 'socket.io';
import { lobbySocketServer, socketClient } from 'src/main.js';
import Go_WsEventManager from 'src/models/go_websocket_manager.js';
import useActivePlayersMap from '../middleware/use_active_players_map.js';

const enterLobby: SocketCallback = (event: string, socket: Socket) => {
  socket.on(event, async (data: IPlayerClientData) => {
    const activePlayers = useActivePlayersMap();
    try {
      data.socketIoId = socket.id;

      let player: Player | null;

      player = activePlayers.getPlayer(data.id);

      if (player) {
        player.socketIoId = data.socketIoId;
        player.inLobby = true;
      } else {
        player = new Player(data.name, data.id, data.email);
        player.socketIoId = data.socketIoId;

        if (socketClient && socketClient.readyState === WebSocket.OPEN) {
          const inLobby = await new Go_WsEventManager<boolean, IPlayerClientData>(socketClient)
            .setEventName('enter-player')
            .setEventHandlerName('player-added')
            .setEventData(player.prepareJsonPlayerToSend())
            .setPendingRequestKey(player.id)
            .build();

          if (inLobby) {
            player.inLobby = true;
            activePlayers.addPlayer(player.id, player);
          }
        }
      }

      lobbySocketServer.emit('new-player', player.prepareJsonPlayerToSend());
    } catch (error) {
      console.error(error);
      activePlayers.deletePlayerFromLobby(data.id);
      throw error;
    }
  });
};

export default enterLobby;
