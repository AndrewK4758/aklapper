import { Game } from '@aklapper/game';
import { InstanceOfGame } from '@aklapper/models';
import { AllGameTypes, GameInstanceID, IBuiltGame, Minute, type GamesInLobbyToSend } from '@aklapper/types';
import { getCurrentMinute } from '@aklapper/utils';
import ShortUniqueId from 'short-unique-id';
import gamesInLobby from '../../data/games_in_lobby/games_in_lobby.js';
import useAllGamesMap from '../../middleware/all-games-map.js';
import useInstanceTimeMap from '../../middleware/instance-map.js';

export default function handleNewGameCall(selectedGame: IBuiltGame): {
  gamesInLobby: GamesInLobbyToSend[];
  gameInstanceId: string;
} {
  const minute: Minute = getCurrentMinute();

  const gamesMap = useAllGamesMap();
  const instanceMap = useInstanceTimeMap();

  const gameID: GameInstanceID = new ShortUniqueId().rnd();

  const game = new Game((selectedGame as IBuiltGame).instance() as AllGameTypes);

  const activeGame = new InstanceOfGame(minute, gameID, game);

  gamesMap.addGame(gameID, activeGame);
  instanceMap.addGameInstance(minute, gameID);
  gamesInLobby.addGame(selectedGame.name, gameID);

  return { gamesInLobby: gamesInLobby.prepDataToSend(), gameInstanceId: gameID };
}
