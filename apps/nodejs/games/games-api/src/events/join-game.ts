import type { JoinGameData, SocketCallback } from '@aklapper/types';
import type { Socket } from 'socket.io';
import gamesInLobby from '../data/games_in_lobby/games_in_lobby.js';
import { lobbySocketServer, socketClient } from '../main.js';
import useActivePlayersMap from '../middleware/use_active_players_map.js';
import Go_WsEventManager from '../models/go_websocket_manager.js';

const joinGame: SocketCallback = (event: string, socket: Socket) => {
  socket.on(event, async ({ gameId, joiningPlayer }: JoinGameData) => {
    console.log(gameId, joiningPlayer);
    try {
      const activePlayers = useActivePlayersMap();
      const activeGame = gamesInLobby.getGameActiveGame(gameId);
      const activePlayer = activePlayers.getPlayer(joiningPlayer.id);
      console.log('joined game active: ', activeGame);

      if (activePlayer && activeGame) {
        activePlayer.activeGameID = gameId;

        const eventData: JoinGameData = {
          gameId: gameId,
          joiningPlayer: activePlayer.prepareJsonPlayerToSend(),
        };
        if (socketClient && socketClient.readyState === WebSocket.OPEN) {
          const playerJoined = await new Go_WsEventManager<boolean, JoinGameData>(socketClient)
            .setEventName('join-game')
            .setEventHandlerName('player-joined')
            .setEventData(eventData)
            .setPendingRequestKey(gameId)
            .build();

          if (playerJoined) {
            activeGame.instance.playersArray.push(activePlayer);
            console.log(`${activeGame.gameInstanceID}: `, activeGame.instance.playersArray);
            lobbySocketServer.emit('player-joined', eventData);
          }
        } else {
          throw activePlayers.NoPlayer(joiningPlayer.id);
        }
      }
    } catch (error) {
      console.error(error);
    }
  });
};

export default joinGame;
