import type { IPlayerClientData, SocketCallback } from '@aklapper/types';
import type { Socket } from 'socket.io';
import useActivePlayersMap from '../middleware/use_active_players_map.js';

const enterLobby: SocketCallback = (event: string, socket: Socket) => {
  socket.on(event, async (data: IPlayerClientData) => {
    try {
      const activePlayers = useActivePlayersMap();
      const player = activePlayers.getPlayer(data.id);
      player.socketIoId = socket.id;

      player.updateActivePlayerDetails(data);

      const playerJson = player.prepareJsonPlayerToSend();

      socket.broadcast.emit('new-player', playerJson);
    } catch (error) {
      console.error(error);
    }
  });
};

export default enterLobby;
