import { PrismaErrorLogger, type PrismaClientErrors } from '@aklapper/games-client';
import { Player } from '@aklapper/games-components';
import type { Email, GameInstanceID, IPlayerClientData } from '@aklapper/types';
import type { Request, Response } from 'express';
import useActivePlayersMap from 'src/middleware/use_active_players_map.js';
import Go_WsEventManager from 'src/models/go_websocket_manager.js';
import findPlayer from 'src/services/prisma/find_player.js';

export default async function getPlayer(req: Request, resp: Response) {
  try {
    const { login } = req.body;

    const activePlayers = useActivePlayersMap();

    const savedPlayer = await findPlayer(login as Email);

    if (savedPlayer) {
      const { player_name, player_id, email } = savedPlayer;

      const newActivePlayer = new Player(player_name, player_id, email as Email);
      const clientPlayerInfo: IPlayerClientData = newActivePlayer.prepareJsonPlayerToSend();

      await new Go_WsEventManager<GameInstanceID, IPlayerClientData>()
        .setEventName('enter-player')
        .setEventHandlerName('player-added')
        .setEventData(clientPlayerInfo)
        .setPendingRequestKey(player_id)
        .build();

      activePlayers.addPlayer(player_id, newActivePlayer);

      resp.status(200).json(newActivePlayer.prepareJsonPlayerToSend());
    }
  } catch (error) {
    const prismaError = new PrismaErrorLogger(error as PrismaClientErrors);
    console.error(prismaError.parseErrors());
    resp.status(404).json({ exists: false });
  }
}
