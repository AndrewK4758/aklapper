import type { PlayerID, SocketCallback } from '@aklapper/types';
import type { Socket } from 'socket.io';
import useActivePlayersMap from 'src/middleware/use_active_players_map.js';
import { socketConnectionMap } from '../main.js';
import { activePubClient } from '../services/redis/redis-client.js';

const disconnectingEvent: SocketCallback = (event: string, socket: Socket) => {
  socket.on(event, async (playerID: PlayerID) => {
    activePubClient.publish('lobby:delete-player', playerID);

    const activePlayers = useActivePlayersMap();

    activePlayers.deletePlayerFromLobby(playerID);

    console.log('DISCONNECT LOBBY EVENT', activePlayers.map);

    socketConnectionMap.delete(playerID);
  });
};

export default disconnectingEvent;
