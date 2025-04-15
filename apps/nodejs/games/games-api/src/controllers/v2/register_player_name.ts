import { PrismaErrorLogger, type PrismaClientErrors } from '@aklapper/games-client';
import { Player } from '@aklapper/games-components';
import type { Request, Response } from 'express';
import ShortUniqueId from 'short-unique-id';
import addPlayerToDb from 'src/services/prisma/add_player.js';
import useActivePlayersMap from '../../middleware/use_active_players_map.js';
import { addPlayerToLobbyGoService } from '../../services/redis/send-message-to-go-service.js';

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

    await addPlayerToLobbyGoService('lobby:new-player', newActivePlayer);
    newActivePlayer.InLobby = true;

    const playerInDB = await addPlayerToDb(newActivePlayer);

    if (playerInDB) {
      activePlayers.addPlayer(playerId, newActivePlayer);

      const clientPlayerInfo: Partial<Player> = {
        Name: newActivePlayer.Name,
        Id: newActivePlayer.Id,
        InLobby: newActivePlayer.InLobby,
        Email: newActivePlayer.email,
        WebsocketId: undefined,
      };

      resp.status(201).json(clientPlayerInfo);
    }
    // Add Service call to DB to store player info if I decide to maintain state past current session
  } catch (error) {
    const prismaError = new PrismaErrorLogger(error as PrismaClientErrors).parseErrors();
    console.error(prismaError);
    resp.status(500).json(prismaError);
  }
}
