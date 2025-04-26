import { Player } from '@aklapper/games-components';
import type { IPlayerClientData, SocketCallback } from '@aklapper/types';
import type { Socket } from 'socket.io';
import { lobbySocketServer } from 'src/main.js';
import Go_WsEventManager from 'src/models/go_websocket_manager.js';
import useActivePlayersMap from '../middleware/use_active_players_map.js';

const enterLobby: SocketCallback = (event: string, socket: Socket) => {
  socket.on(event, async (data: IPlayerClientData) => {
    try {
      data.socketIoId = socket.id;

      let player: Player | null;
      let newLobby: IPlayerClientData[];

      const activePlayers = useActivePlayersMap();
      player = activePlayers.getPlayer(data.id);

      if (player) {
        player.updateActivePlayerDetails(data);
        newLobby = await new Go_WsEventManager<IPlayerClientData[], IPlayerClientData>()
          .setEventName('enter-player')
          .setEventHandlerName('player-added')
          .setEventData(player.prepareJsonPlayerToSend())
          .setPendingRequestKey(player.id)
          .build();

        player.inLobby = true;
      } else {
        player = new Player(data.name, data.id, data.email);
        player.socketIoId = data.socketIoId;

        newLobby = await new Go_WsEventManager<IPlayerClientData[], IPlayerClientData>()
          .setEventName('enter-player')
          .setEventHandlerName('player-added')
          .setEventData(player.prepareJsonPlayerToSend())
          .setPendingRequestKey(player.id)
          .build();

        player.inLobby = true;
      }
      lobbySocketServer.emit('new-player', newLobby);
    } catch (error) {
      console.error(error);
    }
  });
};

export default enterLobby;
