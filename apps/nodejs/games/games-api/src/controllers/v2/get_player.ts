import { PrismaErrorLogger, type PrismaClientErrors } from '@aklapper/games-client';
import type { Email, IPlayerClientData } from '@aklapper/types';
import type { Request, Response } from 'express';
import findPlayer from 'src/services/prisma/find_player.js';

export default async function getPlayer(req: Request, resp: Response) {
  try {
    const { login } = req.body;

    const savedPlayer = await findPlayer(login as Email);

    if (savedPlayer) {
      const { player_name, player_id, email } = savedPlayer;

      const newActivePlayer: IPlayerClientData = {
        name: player_name,
        id: player_id,
        email: email as Email,
        currentTimeEntered: new Date().toISOString(),
        inLobby: false,
        socketIoId: null,
        activeGameID: null,
      };

      resp.status(200).json(newActivePlayer);
    } else resp.sendStatus(404);
  } catch (error) {
    const prismaError = new PrismaErrorLogger(error as PrismaClientErrors);
    console.error(prismaError.parseErrors());
    resp.status(404).json({ exists: false });
  }
}
