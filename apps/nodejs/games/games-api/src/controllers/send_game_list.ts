import type { IBuiltGame } from '@aklapper/types';
import type { Request, Response } from 'express';
import games from '../data/games-list.js';

const sendGameList = (_req: Request, resp: Response): void => {
  const gamesToSend = games.map(game => ({
    name: game.name,
    id: game.id,
    description: game.description,
    rules: game.rules,
    imageURL: game.imageURL,
    players: game.players,
  })) as IBuiltGame[];

  resp.status(200).json(gamesToSend);
};

export default sendGameList;
