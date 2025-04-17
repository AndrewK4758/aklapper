import type { PlayerID, SocketCallback } from '@aklapper/types';
import type { Socket } from 'socket.io';
import useActivePlayersMap from 'src/middleware/use_active_players_map.js';
import go_leaveLobby from 'src/services/lobby/handle_leave_lobby.js';
import { socketConnectionMap } from '../main.js';

const handleLeaveLobby: SocketCallback = (event: string, socket: Socket) => {
  socket.on(event, async (playerID: PlayerID) => {
    const activePlayers = useActivePlayersMap();

    const deletedPlayer = await go_leaveLobby('remove-player', playerID);

    if (deletedPlayer) activePlayers.deletePlayerFromLobby(playerID);

    console.log('DISCONNECT LOBBY EVENT', activePlayers.map);

    socketConnectionMap.delete(deletedPlayer);
  });
};

export default handleLeaveLobby;
