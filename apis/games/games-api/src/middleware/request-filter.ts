import { GameNameString, IBuiltGame, PlayerID } from '@aklapper/types';
import { NextFunction, Request, Response, Router } from 'express';
import useAllGamesMap from './all-games-map.js';
import useInstanceTimeMap from './instance-map.js';
import useSetSelectedGameName from './set-selected-game-name.js';
import useActiveGameInstance from './use-active-game-instance.js';
import usePlayerID from './use-player-id.js';
import useSelectedGame from './use-selected-game.js';

const reqFilter = (req: Request, _resp: Response, next: NextFunction): void => {
  req.playerID = usePlayerID(req) as PlayerID;
  req.selectedGameName = useSetSelectedGameName(req) as GameNameString;
  req.selectedGame = useSelectedGame(req);
  req.allGamesMap = useAllGamesMap();
  req.instanceMap = useInstanceTimeMap();
  req.activeGameInstance = useActiveGameInstance(req);
  req.gameSpecificChain = (req.selectedGame as IBuiltGame).chain ?? null;
  next();
};

const middlewareRouter: Router = Router();

middlewareRouter.use('/:id', reqFilter);

export default middlewareRouter;
