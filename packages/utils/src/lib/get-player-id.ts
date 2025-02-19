import { GamePlayerValidation } from '@aklapper/types';
import { Request } from 'express';

export const getPlayerID = (req: Request) => {
  const __current_game__ = JSON.parse(
    req.header('current-game') as string,
  ) as GamePlayerValidation;
  return __current_game__.playerID;
};
