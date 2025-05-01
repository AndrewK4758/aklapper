import { Game } from '@aklapper/game';
import { InstanceOfGame } from '@aklapper/models';
import type { AllGameTypes, GameInstanceID, GameInstanceLobbyData, IBuiltGame, Minute } from '@aklapper/types';
import { getCurrentMinute } from '@aklapper/utils';
import ShortUniqueId from 'short-unique-id';
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

      const game = new Game((selectedGame as IBuiltGame).instance() as AllGameTypes);

      game.playersArray.push(playerToAdd);

      const activeGame = new InstanceOfGame(minute, gameID, game);

      const eventData: GameInstanceLobbyData = {
        gameInstanceID: activeGame.gameInstanceID,
        gameName: activeGame.instance.instance.NAME,
        inLobby: true,
        playersArray: activeGame.instance.playersArray.map(player => player.prepareJsonPlayerToSend()),
      };

      const gameInLobby = await new Go_WsEventManager<boolean, GameInstanceLobbyData>()
        .setEventName('new-game')
        .setEventHandlerName('game-added')
        .setEventData(eventData)
        .setPendingRequestKey(gameID)
        .build();

      if (gameInLobby) {
        gamesMap.addGame(gameID, activeGame);
        instanceMap.addGameInstance(minute, gameID);
        gamesInLobby.addGame(gameID, activeGame);
        return eventData;
      } else {
        return false;
      }
    } else throw playersMap.NoPlayer(playerId);
  } catch (error) {
    const err = error as Error;
    console.error(err);
    throw error;
  }
}
