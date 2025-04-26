import { Game } from '@aklapper/game';
import { Player } from '@aklapper/games-components';
import { InstanceOfGame } from '@aklapper/models';
import type { AllGameTypes, ClientLobbyData, IBuiltGame } from '@aklapper/types';
import { getCurrentMinute } from '@aklapper/utils';
import ShortUniqueId from 'short-unique-id';
import Go_WsEventManager from 'src/models/go_websocket_manager.js';
import games from '../../data/games-list.js';
import gamesInLobby from '../../data/games_in_lobby/games_in_lobby.js';
import useActivePlayersMap from '../../middleware/use_active_players_map.js';

export default async function syncWithGoLobby() {
  const activeGames = gamesInLobby.map;
  const activePlayers = useActivePlayersMap();

  const lobbySyncWsId = new ShortUniqueId().rnd(6);

  const lobbySyncData = await new Go_WsEventManager<ClientLobbyData>()
    .setEventName('data-sync-request')
    .setEventHandlerName('data-sync-response')
    .setPendingRequestKey(lobbySyncWsId)
    .build();

  const { activeGamesInLobby, activePlayersInLobby } = lobbySyncData;

  activeGamesInLobby.forEach(game => {
    const gameInstance = games.find(g => g.name === game.gameName) as IBuiltGame;

    const newGame = new Game(gameInstance.instance() as AllGameTypes);

    game.playersArray = game.playersArray.map(p => {
      const newPlayer = new Player(p.name, p.id, p.email);
      newPlayer.updateActivePlayerDetails(p);
      activePlayers.addPlayer(p.id, newPlayer);
      return newPlayer;
    });

    const instanceOfGame = new InstanceOfGame(getCurrentMinute(), game.gameInstanceID, newGame);

    activeGames.set(game.gameInstanceID, instanceOfGame);
  });

  activePlayersInLobby.forEach(player => {
    if (!activePlayers.map.has(player.id)) {
      const newPlayer = new Player(player.name, player.id, player.email);
      newPlayer.updateActivePlayerDetails(player);
      activePlayers.addPlayer(player.id, newPlayer);
    }
  });
}
