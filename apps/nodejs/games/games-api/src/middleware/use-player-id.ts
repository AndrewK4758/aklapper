import type { GamePlayerValidation } from '@aklapper/types';
import type { Request } from 'express';

const usePlayerID = (req: Request) =>
  req.header('current-game') ? (JSON.parse(req.header('current-game') as string) as GamePlayerValidation).playerID : '';

export default usePlayerID;
