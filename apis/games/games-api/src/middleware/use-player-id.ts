import { Request } from 'express';
import { GamePlayerValidation } from '@aklapper/types-game';

const usePlayerID = (req: Request) =>
  req.header('current-game') ? (JSON.parse(req.header('current-game') as string) as GamePlayerValidation).playerID : '';

export default usePlayerID;
