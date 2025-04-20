import type { PlayerID, SocketCallback, WsResponse } from '@aklapper/types';
import type { Socket } from 'socket.io';
import useActivePlayersMap from 'src/middleware/use_active_players_map.js';
import go_leaveLobby from 'src/services/lobby/handle_leave_lobby.js';
import { socketConnectionMap } from '../main.js';

const handleLeaveLobby: SocketCallback = (event: string, socket: Socket) => {
  socket.on(event, async (playerID: PlayerID) => {
    const activePlayers = useActivePlayersMap();

    const leaveLobbyResponse: WsResponse = await go_leaveLobby('remove-player', playerID);

    const { status, response } = leaveLobbyResponse;

    if (status === 'success') {
      activePlayers.deletePlayerFromLobby(playerID);
      socketConnectionMap.delete(response as string);
    }
  });
};

export default handleLeaveLobby;
