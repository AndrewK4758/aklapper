import { Game } from '@aklapper/game';
import { InstanceOfGame } from '@aklapper/models';
import type {
  AllGameTypes,
  GameInstanceID,
  GameInstanceLobbyData,
  Go_NewGameData,
  IBuiltGame,
  Minute,
} from '@aklapper/types';
import { getCurrentMinute } from '@aklapper/utils';
import ShortUniqueId from 'short-unique-id';
import { socketClient } from 'src/main.js';
import Go_WsEventManager from 'src/models/go_websocket_manager.js';
import gamesInLobby from '../../data/games_in_lobby/games_in_lobby.js';
import useAllGamesMap from '../../middleware/all-games-map.js';
import useInstanceTimeMap from '../../middleware/instance-map.js';
import useActivePlayersMap from '../../middleware/use_active_players_map.js';

export default async function generateNewGame(
  selectedGame: IBuiltGame,
  playerId: string,
): Promise<GameInstanceLobbyData | boolean> {
  try {
    const minute: Minute = getCurrentMinute();

    const gamesMap = useAllGamesMap();
    const instanceMap = useInstanceTimeMap();
    const playersMap = useActivePlayersMap();

    const playerToAdd = playersMap.getPlayer(playerId);

    if (playerToAdd) {
      const gameID: GameInstanceID = new ShortUniqueId().rnd();
      playerToAdd.activeGameID = gameID;

      const game = new Game(selectedGame.instance() as AllGameTypes);

      game.playersArray.push(playerToAdd);

      const instanceOfGame = new InstanceOfGame(minute, gameID, game);

      const eventData: Go_NewGameData = {
        playerId: playerId,
        newGame: {
          gameInstanceID: gameID,
          gameName: selectedGame.name,
          // change to false and only set true when response from go websocket is success
          inLobby: true,
          playersArray: instanceOfGame.instance.playersArray.map(p => p.prepareJsonPlayerToSend()),
        },
      };
      if (socketClient && socketClient.readyState === WebSocket.OPEN) {
        const gameInLobby = await new Go_WsEventManager<boolean, Go_NewGameData>(socketClient)
          .setEventName('new-game')
          .setEventHandlerName('game-added')
          .setEventData(eventData)
          .setPendingRequestKey(gameID)
          .build();

        if (gameInLobby) {
          gamesMap.addGame(gameID, instanceOfGame);
          instanceMap.addGameInstance(minute, gameID);
          gamesInLobby.addGame(gameID, instanceOfGame);
          return eventData.newGame;
        } else {
          return false;
        }
      } else throw playersMap.NoPlayer(playerId);
    } else return false;
  } catch (error) {
    const err = error as Error;
    console.error(err);
    throw error;
  }
}
