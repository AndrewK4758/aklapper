import { Router } from 'express';
import registerPlayerName from '../../controllers/v2/register_player_name.js';
import middlewareRouter from '../../middleware/request-filter.js';

const routerV2: Router = Router();

routerV2.use('/games', middlewareRouter);

routerV2.post('/register', registerPlayerName);

export default routerV2;
