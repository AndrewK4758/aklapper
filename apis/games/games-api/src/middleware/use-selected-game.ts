import { IBuiltGame } from '@aklapper/types-game';
import games from '../data/games-list';
import type { Request } from 'express';

const useSelectedGame = (req: Request): IBuiltGame | undefined =>
  games.find(({ name }) => name === req.selectedGameName);

export default useSelectedGame;
