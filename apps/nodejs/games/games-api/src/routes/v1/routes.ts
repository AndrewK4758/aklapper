import { type Request, type Response, Router } from 'express';
import performAction from '../../controllers/perform_action_context_object.js';
import sendGameList from '../../controllers/send_game_list.js';
import populateInstanceMaps from '../../controllers/v1/populate_instance_map.js';
import middlewareRouter from '../../middleware/request-filter.js';

const routerV1: Router = Router();

// ROUTER MIDDLEWARE
routerV1.use('/games', middlewareRouter);
// ENDPOINTS
routerV1.get('/', (_, resp) => {
  resp.sendStatus(201);
});
routerV1.get('/games', sendGameList);
routerV1.post('/games/:id', populateInstanceMaps);
routerV1.patch('/games/:id/:action', (req: Request, resp: Response) => performAction(req, resp, null, null));
routerV1.patch('/join-game', (req: Request, resp: Response) => performAction(req, resp, null, null));

export default routerV1;
