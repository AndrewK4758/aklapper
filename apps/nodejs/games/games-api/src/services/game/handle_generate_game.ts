import { Game } from '@aklapper/game';
import { InstanceOfGame } from '@aklapper/models';
import type {
  AllGameTypes,
  GameInsanceLobbyData,
  GameInstanceID,
  IBuiltGame,
  Minute,
  WsLobbyEventData,
} from '@aklapper/types';
import { getCurrentMinute } from '@aklapper/utils';
import ShortUniqueId from 'short-unique-id';
import gamesInLobby from '../../data/games_in_lobby/games_in_lobby.js';
import useAllGamesMap from '../../middleware/all-games-map.js';
import useInstanceTimeMap from '../../middleware/instance-map.js';
import useActivePlayersMap from '../../middleware/use_active_players_map.js';
// import go_NewGame from '../lobby/handle_new_game.js';
import Go_WsEventManager from 'src/models/go_websocket_manager.js';
// import go_wsEventHandler from 'src/models/handle_go_ws_event.js';

export default async function generateNewGame(selectedGame: IBuiltGame, playerId: string): Promise<WsLobbyEventData> {
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

      const eventData: GameInsanceLobbyData = {
        gameInstanceID: activeGame.gameInstanceID,
        gameName: activeGame.instance.instance.NAME,
        inLobby: true,
        playersArray: activeGame.instance.playersArray.map(player => player.prepareJsonPlayerToSend()),
      };

      const newGameIdKey = await new Go_WsEventManager<GameInstanceID, GameInsanceLobbyData>()
        .setEventName('new-game')
        .setEventHandlerName('game-added')
        .setEventData(eventData)
        .setPendingRequestKey(gameID)
        .build();

      // go_wsEventHandler<GameInsanceLobbyData, GameInstanceID>(
      // 'new-game',
      // 'game-added',
      // eventData,
      // gameID,
      // );

      gamesMap.addGame(newGameIdKey, activeGame);
      instanceMap.addGameInstance(minute, newGameIdKey);
      gamesInLobby.addGame(newGameIdKey, activeGame);

      return { newGameId: newGameIdKey, gamesInLobby: gamesInLobby.prepDataToSend() };
    } else throw playersMap.NoPlayer(playerId);
  } catch (error) {
    const err = error as Error;
    console.error(err);
    throw error;
  }
}
