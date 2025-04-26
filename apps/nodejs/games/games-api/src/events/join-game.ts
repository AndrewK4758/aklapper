import type { IPlayerClientData, SocketCallback, WsLobbyEventData } from '@aklapper/types';
import type { Socket } from 'socket.io';
import gamesInLobby from 'src/data/games_in_lobby/games_in_lobby.js';
import useActivePlayersMap from 'src/middleware/use_active_players_map.js';

const joinGame: SocketCallback = (event: string, socket: Socket) => {
  socket.on(event, ({ gameId, playerData }: { gameId: string; playerData: IPlayerClientData }) => {
    try {
      const activePlayers = useActivePlayersMap();
      const activeGame = gamesInLobby.getGameActiveGame(gameId);
      const activePlayer = activePlayers.getPlayer(playerData.id);

      if (activePlayer) {
        activePlayer.updateActivePlayerDetails(playerData);

        activeGame.instance.playersArray.push(activePlayer);

        const updatedGameLobby: WsLobbyEventData = {
          newGameId: gameId,
          gamesInLobby: gamesInLobby.prepDataToSend(),
        };

        socket.broadcast.emit('player-added', updatedGameLobby);
      } else {
        throw activePlayers.NoPlayer(playerData.id);
      }
    } catch (error) {
      console.error(error);
    }
  });
};

export default joinGame;
