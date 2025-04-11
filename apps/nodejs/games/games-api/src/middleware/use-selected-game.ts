import type { IBuiltGame } from '@aklapper/types';
import type { Request } from 'express';
import games from '../data/games-list.js';

const useSelectedGame = (req: Request): IBuiltGame | undefined =>
  games.find(({ name }) => name === req.selectedGameName);

export default useSelectedGame;
