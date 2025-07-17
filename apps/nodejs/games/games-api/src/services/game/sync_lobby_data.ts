import { Game } from '@aklapper/game';
import { Player } from '@aklapper/games-components';
import { InstanceOfGame } from '@aklapper/models';
import type { AllGameTypes, ClientLobbyData, IBuiltGame } from '@aklapper/types';
import { getCurrentMinute } from '@aklapper/utils';
import ShortUniqueId from 'short-unique-id';
import games from '../../data/games-list.js';
import gamesInLobby from '../../data/games_in_lobby/games_in_lobby.js';
import { socketClient } from '../../main.js';
import useActivePlayersMap from '../../middleware/use_active_players_map.js';
import Go_WsEventManager from '../../models/go_websocket_manager.js';

export default async function syncWithGoLobby() {
  const activeGames = gamesInLobby.map;
  const activePlayersMap = useActivePlayersMap();

  const lobbySyncWsId = new ShortUniqueId().rnd(6);
  if (socketClient && socketClient.readyState === WebSocket.OPEN) {
    const lobbySyncData = await new Go_WsEventManager<ClientLobbyData>(socketClient)
      .setEventName('data-sync-request')
      .setEventHandlerName('data-sync-response')
      .setPendingRequestKey(lobbySyncWsId)
      .build();

    const { activeGamesInLobby, activePlayersInLobby } = lobbySyncData;

    activeGamesInLobby.forEach(game => {
      const gameInstance = games.find(g => g.name === game.gameName) as IBuiltGame;
      console.log('active games in lobby', game);
      const newGame = new Game(gameInstance.instance() as AllGameTypes);

      const activePlayers = (game.playersArray = game.playersArray.map(p => {
        const newPlayer = new Player(p.name, p.id, p.email);
        newPlayer.activeGameID = game.gameInstanceID;
        activePlayersMap.addPlayer(p.id, newPlayer);
        return newPlayer;
      }));

      newGame.playersArray = [...activePlayers];
      const instanceOfGame = new InstanceOfGame(getCurrentMinute(), game.gameInstanceID, newGame);

      activeGames.set(game.gameInstanceID, instanceOfGame);
    });

    activePlayersInLobby.forEach(player => {
      if (!activePlayersMap.map.has(player.id)) {
        const newPlayer = new Player(player.name, player.id, player.email);
        activePlayersMap.addPlayer(player.id, newPlayer);
      }
    });
  }
}
