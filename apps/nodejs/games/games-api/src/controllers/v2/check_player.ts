import type { Email } from '@aklapper/types';
import type { Request, Response } from 'express';
import existsPlayer from '../../services/prisma/exists_player.js';

export default async function checkPlayer(req: Request, resp: Response) {
  try {
    const { email } = req.query;

    if (!email) {
      resp.status(404).send('no player email provided');
      return;
    }

    const playerExists = await existsPlayer(email as Email);

    resp.status(200).json({ exists: playerExists });
  } catch (error) {
    console.error(error);
  }
}
