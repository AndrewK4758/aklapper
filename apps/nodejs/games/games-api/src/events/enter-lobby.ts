import type { IPlayer, SocketCallback } from '@aklapper/types';
import type { Socket } from 'socket.io';
import useActivePlayersMap from '../middleware/use_active_players_map.js';

const enterLobby: SocketCallback = (event: string, socket: Socket) => {
  socket.on(event, (data: IPlayer) => {
    try {
      const activePlayers = useActivePlayersMap();
      const player = activePlayers.getPlayer(data.Id);
      player.WebsocketId = socket.id;

      const { Name, Id, ActiveGameID, WebsocketId, InLobby } = player;

      socket.broadcast.emit('new-player', { Name, Id, ActiveGameID, WebsocketId, InLobby });
    } catch (error) {
      console.error(error);
    }
  });
};

export default enterLobby;
