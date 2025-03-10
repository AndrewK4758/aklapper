import express, { Request, Response, Router } from 'express';
import performAction from '../controllers/perform_action_context_object.js';
import populateInstanceMaps from '../controllers/populate_instance_map.js';
import sendGameList from '../controllers/send_game_list.js';
import middlewareRouter from '../middleware/request-filter.js';

const router: Router = Router();

export class GameRoutes {
  constructor() {
    // ROUTER MIDDLEWARE
    router.use(express.json());
    router.use(express.urlencoded({ extended: true }));
    router.use('/games', middlewareRouter);
    // ENDPOINTS
    router.get('/games', sendGameList);
    router.post('/games/:id', populateInstanceMaps);
    router.patch('/games/:id/:action', (req: Request, resp: Response) =>
      performAction(req, resp, null, null),
    );
    router.patch('/join-game', (req: Request, resp: Response) =>
      performAction(req, resp, null, null),
    );
  }
}

export default router;
