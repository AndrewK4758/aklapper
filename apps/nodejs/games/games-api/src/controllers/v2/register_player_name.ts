import { PrismaErrorLogger, type PrismaClientErrors } from '@aklapper/games-client';
import { Player } from '@aklapper/games-components';
import type { IPlayerClientData } from '@aklapper/types';
import type { Request, Response } from 'express';
import ShortUniqueId from 'short-unique-id';
import addPlayerToDb from 'src/services/prisma/add_player.js';

// 2 Data structures
// X 1 SET for active players in lobby for emit event when new player arrives, new game created, player leaves
// 1 Adapt the Game class to handle more data for players in game and removing players from lobby when game starts
// and emitting game id with player name whom created game when instanciated

export default async function registerPlayerName(req: Request, resp: Response): Promise<void> {
  try {
    const { name, email } = req.body;

    const playerId = new ShortUniqueId().rnd(6);
    const newActivePlayer = new Player(name, playerId, email);
    const clientPlayerInfo: IPlayerClientData = newActivePlayer.prepareJsonPlayerToSend();

    newActivePlayer.inLobby = true;

    const playerInDB = await addPlayerToDb(newActivePlayer);

    if (playerInDB) {
      resp.status(201).json(clientPlayerInfo);
    } else {
      resp.sendStatus(500);
    }
    // Add Service call to DB to store player info if I decide to maintain state past current session
  } catch (error) {
    const prismaError = new PrismaErrorLogger(error as PrismaClientErrors).parseErrors();
    console.error(prismaError);
    resp.status(500).json(prismaError);
  }
}
