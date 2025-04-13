import { Player } from '@aklapper/games-components';
import type { Email } from '@aklapper/types';
import { PrismaErrorLogger, type PrismaClientErrors } from '@aklapper/utils';
import type { Request, Response } from 'express';
import useActivePlayersMap from 'src/middleware/use_active_players_map.js';
import findPlayer from 'src/services/prisma/find_player.js';
import { addPlayerToLobbyGoService } from 'src/services/redis/send-message-to-go-service.js';

export default async function getPlayer(req: Request, resp: Response) {
  try {
    const { login } = req.body;

    const activePlayers = useActivePlayersMap();

    const savedPlayer = await findPlayer(login as Email);

    if (savedPlayer) {
      console.log('saved Player');
      const { player_name, player_id, email } = savedPlayer;
      const activePlayer = new Player(player_name, player_id, email as Email);

      await addPlayerToLobbyGoService('lobby:new-player', activePlayer);
      activePlayer.InLobby = true;

      activePlayers.addPlayer(player_id, activePlayer);

      const clientPlayerInfo: Partial<Player> = {
        Name: activePlayer.Name,
        Id: activePlayer.Id,
        InLobby: activePlayer.InLobby,
        Email: activePlayer.email,
        WebsocketId: undefined,
      };

      resp.status(200).json(clientPlayerInfo);
    }
  } catch (error) {
    const prismaError = new PrismaErrorLogger(error as PrismaClientErrors);
    console.error(prismaError.parseErrors());
    resp.status(404).json({ exists: false });
  }
}
