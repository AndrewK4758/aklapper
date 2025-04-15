// import type { Request, Response } from 'express';
// import useActivePlayersMap from 'src/middleware/use_active_players_map.js';

// // import { addPlayerToLobbyGoService } from 'src/services/redis/send-message-to-go-service.js';

// export default async function logoutPlayer(req: Request, resp: Response) {
//   try {
//     const { playerID } = req.body;

//     const activePlayers = useActivePlayersMap();

//     activePlayers.deletePlayerFromLobby(playerID);

//     resp.status(200).json({ [playerID]: 'removed' });
//   } catch (error) {
//     console.error(error);
//   }
// }
