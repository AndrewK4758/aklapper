import type { JoinGameData, SocketCallback } from '@aklapper/types';
import type { Socket } from 'socket.io';
import gamesInLobby from 'src/data/games_in_lobby/games_in_lobby.js';
import { lobbySocketServer } from 'src/main.js';
import useActivePlayersMap from 'src/middleware/use_active_players_map.js';
import Go_WsEventManager from 'src/models/go_websocket_manager.js';

const joinGame: SocketCallback = (event: string, socket: Socket) => {
  socket.on(event, async ({ gameId, playerData }: JoinGameData) => {
    try {
      const activePlayers = useActivePlayersMap();
      const activeGame = gamesInLobby.getGameActiveGame(gameId);
      const activePlayer = activePlayers.getPlayer(playerData.id);

      if (activePlayer && activeGame) {
        activeGame.instance.playersArray.push(activePlayer);

        const eventData: JoinGameData = {
          gameId: gameId,
          playerData: activePlayer.prepareJsonPlayerToSend(),
        };

        const playerJoined = await new Go_WsEventManager<boolean, JoinGameData>()
          .setEventName('join-game')
          .setEventHandlerName('player-joined')
          .setEventData(eventData)
          .setPendingRequestKey(gameId)
          .build();

        console.log(playerJoined);
        if (playerJoined) {
          lobbySocketServer.emit('player-joined', eventData);
        }
      } else {
        throw activePlayers.NoPlayer(playerData.id);
      }
    } catch (error) {
      console.error(error);
    }
  });
};

export default joinGame;
