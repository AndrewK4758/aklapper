import type { IPlayerClientData, SocketCallback } from '@aklapper/types';
import type { Socket } from 'socket.io';
import gamesInLobby from 'src/data/games_in_lobby/games_in_lobby.js';
import { lobbySocketServer } from 'src/main.js';
import useActivePlayersMap from 'src/middleware/use_active_players_map.js';
import Go_WsEventManager from 'src/models/go_websocket_manager.js';

const joinGame: SocketCallback = (event: string, socket: Socket) => {
  socket.on(event, async ({ gameId, playerData }: { gameId: string; playerData: IPlayerClientData }) => {
    console.log('player data', playerData);
    try {
      const activePlayers = useActivePlayersMap();
      const activeGame = gamesInLobby.getGameActiveGame(gameId);
      const activePlayer = activePlayers.getPlayer(playerData.id);
      if (activePlayer) {
        console.log('if active player', activePlayer);

        activeGame.instance.playersArray.push(activePlayer);

        const eventData = {
          gameId: gameId,
          newPlayer: activePlayer.prepareJsonPlayerToSend(),
        };

        new Go_WsEventManager()
          .setEventName('join-game')
          .setEventHandlerName('player-joined')
          .setEventData(eventData)
          .setPendingRequestKey(gameId)
          .build();

        console.log(playerData);
        console.log(gamesInLobby.prepDataToSend());
        lobbySocketServer.emit('player-joined', {
          gameId: gameId,
          newPlayer: activePlayer.prepareJsonPlayerToSend(),
          newLobby: gamesInLobby.prepDataToSend(),
        });
      } else {
        throw activePlayers.NoPlayer(playerData.id);
      }
    } catch (error) {
      console.error(error);
    }
  });
};

export default joinGame;
