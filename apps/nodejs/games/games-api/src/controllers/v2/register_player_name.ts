import { Player } from '@aklapper/games-components';
import type { IPlayer } from '@aklapper/types';
import type { Request, Response } from 'express';
import ShortUniqueId from 'short-unique-id';
import genericError from '../../errors/genenric_error.js';
import { addPlayerToLobbyGoService } from '../../services/redis/send-message-to-go-service.js';

// 2 Data structures
// X 1 SET for active players in lobby for emit event when new player arrives, new game created, player leaves
// 1 Adapt the Game class to handle more data for players in game and removing players from lobby when game starts
// and emitting game id with player name whom created game when instanciated

export default async function registerPlayerName(req: Request, resp: Response): Promise<void> {
  try {
    const { name } = req.body;

    const playerId = new ShortUniqueId().rnd(6);

    const newActivePlayer = new Player(name, playerId);

    const playerInLobby = await addPlayerToLobbyGoService('lobby:new-player', newActivePlayer);

    const currentPlayerInLobby = JSON.parse(playerInLobby) as IPlayer;

    const clientPlayerInfo: Partial<IPlayer> = {
      Name: currentPlayerInLobby.Name,
      Id: currentPlayerInLobby.Id,
      InLobby: currentPlayerInLobby.InLobby
    };

    resp.status(201).json(clientPlayerInfo);

    // Add Service call to DB to store player info if I decide to maintain state past current session
  } catch (error) {
    console.error(error);
    resp.status(500).json(genericError('Error creating Player. Please refresh page and try again', error as Error));
  }

  return;
}
