import { PrismaErrorLogger, type PrismaClientErrors } from '@aklapper/games-client';
import { Player } from '@aklapper/games-components';
import type { IPlayerClientData, PlayerID /*WsResponse*/ } from '@aklapper/types';
import type { Request, Response } from 'express';
import ShortUniqueId from 'short-unique-id';
import Go_WsEventManager from 'src/models/go_websocket_manager.js';
import addPlayerToDb from 'src/services/prisma/add_player.js';
import useActivePlayersMap from '../../middleware/use_active_players_map.js';

// import { addPlayerToLobbyGoService } from '../../services/redis/send-message-to-go-service.js';

// 2 Data structures
// X 1 SET for active players in lobby for emit event when new player arrives, new game created, player leaves
// 1 Adapt the Game class to handle more data for players in game and removing players from lobby when game starts
// and emitting game id with player name whom created game when instanciated

export default async function registerPlayerName(req: Request, resp: Response): Promise<void> {
  try {
    const { name, email } = req.body;

    const playerId = new ShortUniqueId().rnd(6);
    const activePlayers = useActivePlayersMap();
    const newActivePlayer = new Player(name, playerId, email);
    const clientPlayerInfo: IPlayerClientData = newActivePlayer.prepareJsonPlayerToSend();

    newActivePlayer.inLobby = true;

    const playerInDB = await addPlayerToDb(newActivePlayer);

    if (playerInDB) {
      const addedPlayerId = await new Go_WsEventManager<PlayerID, IPlayerClientData>()
        .setEventName('new-player')
        .setEventHandlerName('player-added')
        .setEventData(clientPlayerInfo)
        .setPendingRequestKey(playerId)
        .build();
      // await go_wsEventHandler<IPlayerClientData, PlayerID>(
      // 'new-player',
      // 'player-added',
      // clientPlayerInfo,
      // );

      activePlayers.addPlayer(addedPlayerId, newActivePlayer);
      resp.status(201).json(clientPlayerInfo);
    }
    // Add Service call to DB to store player info if I decide to maintain state past current session
  } catch (error) {
    const prismaError = new PrismaErrorLogger(error as PrismaClientErrors).parseErrors();
    console.error(prismaError);
    resp.status(500).json(prismaError);
  }
}
