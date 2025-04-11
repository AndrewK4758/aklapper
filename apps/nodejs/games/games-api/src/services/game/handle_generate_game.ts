import { Game } from '@aklapper/game';
import { InstanceOfGame } from '@aklapper/models';
import type { AllGameTypes, GameInstanceID, IBuiltGame, Minute, NewGameDetails } from '@aklapper/types';
import { getCurrentMinute } from '@aklapper/utils';
import ShortUniqueId from 'short-unique-id';
import gamesInLobby from '../../data/games_in_lobby/games_in_lobby.js';
import useAllGamesMap from '../../middleware/all-games-map.js';
import useInstanceTimeMap from '../../middleware/instance-map.js';
import useActivePlayersMap from '../../middleware/use_active_players_map.js';

export default function handleNewGameCall(selectedGame: IBuiltGame, playerId: string): NewGameDetails | void {
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

    gamesMap.addGame(gameID, activeGame);
    instanceMap.addGameInstance(minute, gameID);
    gamesInLobby.addGame(selectedGame.name, activeGame);

    return { gamesInLobby: gamesInLobby.prepDataToSend(), gameId: gameID, gameName: selectedGame.name };
  } catch (error) {
    const err = error as Error;
    console.error(err);
  }
}
