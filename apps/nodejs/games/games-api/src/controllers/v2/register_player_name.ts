import { Player } from '@aklapper/games-components';
import type { IClientPlayerInfo } from '@aklapper/types';
import type { Request, Response } from 'express';
import ShortUniqueId from 'short-unique-id';
import genericError from '../../errors/genenric_error.js';

// 2 Data structures
// 1 SET for active players in lobby for emit event when new player arrives, new game created, player leaves
// 1 Adapt the Game class to handle more data for players in game and removing players from lobby when game starts
// and emitting game id with player name whom created game when instanciated

export default async function registerPlayerName(req: Request, resp: Response): Promise<void> {
  try {
    const { name } = req.body;

    const playerId = new ShortUniqueId().rnd(6);

    const newActivePlayer = new Player(name, playerId);

    // Add Service call to DB to store player info if I decide to maintain state past current session

    const clientPlayerInfo: IClientPlayerInfo = {
      name: newActivePlayer.name,
      id: newActivePlayer.id,
      inLobby: newActivePlayer.inLobby
    };

    resp.status(201).json(clientPlayerInfo);
  } catch (error) {
    console.error(error);
    resp.status(500).json(genericError('Error creating Player. Please refresh page and try again', error as Error));
  }

  return;
}
