import type { IBuiltGame } from '@aklapper/types';
import { Request, Response } from 'express';
import games from '../data/games-list.js';

const sendGameList = async (_req: Request, resp: Response): Promise<void> => {
  const gamesToSend = games.map(game => ({
    name: game.name,
    id: game.id,
    description: game.description,
    rules: game.rules,
    imageURL: game.imageURL,
    players: game.players
  })) as IBuiltGame[];

  resp.status(200).json(gamesToSend);
};

export default sendGameList;
