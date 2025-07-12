import { Router } from 'express';
import checkPlayer from '../../controllers/v2/check_player.js';
import getLobbyState from '../../controllers/v2/get_lobby_state.js';
import getPlayer from '../../controllers/v2/get_player.js';
import registerPlayerName from '../../controllers/v2/register_player_name.js';
import middlewareRouter from '../../middleware/request-filter.js';

const routerV2: Router = Router();

routerV2.use('/games', middlewareRouter);

routerV2.post('/login', getPlayer);

routerV2.get('/player-exists', checkPlayer);
routerV2.get('/lobby', getLobbyState);
routerV2.post('/register', registerPlayerName);

export default routerV2;
