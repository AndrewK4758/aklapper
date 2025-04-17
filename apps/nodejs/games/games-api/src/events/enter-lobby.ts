import { Player } from '@aklapper/games-components';
import type { IPlayer, SocketCallback } from '@aklapper/types';
import type { Socket } from 'socket.io';
import useActivePlayersMap from '../middleware/use_active_players_map.js';

const enterLobby: SocketCallback = (event: string, socket: Socket) => {
  socket.on(event, (data: IPlayer) => {
    try {
      const activePlayers = useActivePlayersMap();
      const player = activePlayers.getPlayer(data.id);
      player.socketIoId = socket.id;

      const playerInstance = Player.UpdateActivePlayer(data, activePlayers);

      const playerJson = Player.PrepareJsonPlayerToSend(playerInstance);
      // const { name, id, activeGameID, websocketId, inLobby } = player;

      socket.broadcast.emit('new-player', playerJson);
    } catch (error) {
      console.error(error);
    }
  });
};

export default enterLobby;
