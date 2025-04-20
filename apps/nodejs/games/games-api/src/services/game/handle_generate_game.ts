import { Game } from '@aklapper/game';
import { InstanceOfGame } from '@aklapper/models';
import type {
  AllGameTypes,
  // GameInsanceLobbyData,
  GameInstanceID,
  IBuiltGame,
  Minute,
  NewGameDetails,
  WsResponse,
} from '@aklapper/types';
import { getCurrentMinute } from '@aklapper/utils';
import ShortUniqueId from 'short-unique-id';
import gamesInLobby from '../../data/games_in_lobby/games_in_lobby.js';
import useAllGamesMap from '../../middleware/all-games-map.js';
import useInstanceTimeMap from '../../middleware/instance-map.js';
import useActivePlayersMap from '../../middleware/use_active_players_map.js';
import go_NewGame from '../lobby/handle_new_game.js';

export default async function generateNewGame(selectedGame: IBuiltGame, playerId: string): Promise<NewGameDetails> {
  try {
    const minute: Minute = getCurrentMinute();

    const gamesMap = useAllGamesMap();
    const instanceMap = useInstanceTimeMap();
    const playersMap = useActivePlayersMap();

    const playerToAdd = playersMap.getPlayer(playerId);

    const gameID: GameInstanceID = new ShortUniqueId().rnd();

    const game = new Game((selectedGame as IBuiltGame).instance() as AllGameTypes);

    game.playersArray.push(playerToAdd);

    const activeGame = new InstanceOfGame(minute, gameID, game);

    const newGameResponse: WsResponse = await go_NewGame(activeGame, gameID);

    const { status, response } = newGameResponse;

    if (status === 'success') {
      gamesMap.addGame(gameID, activeGame);
      instanceMap.addGameInstance(minute, gameID);
      gamesInLobby.addGame(gameID, activeGame);

      return { newGameId: gameID, gamesInLobby: gamesInLobby.prepDataToSend() };
    } else throw new Error(response as string);
  } catch (error) {
    const err = error as Error;
    console.error(err);
    throw error;
  }
}
