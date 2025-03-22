import { Router } from 'express';
import getLobbyState from '../../controllers/v2/get_lobby_state.js';
import registerPlayerName from '../../controllers/v2/register_player_name.js';
import middlewareRouter from '../../middleware/request-filter.js';

const routerV2: Router = Router();

routerV2.use('/games', middlewareRouter);

routerV2.get('/lobby', getLobbyState);
routerV2.post('/register', registerPlayerName);

export default routerV2;
