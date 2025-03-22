import { IPlayer } from '@aklapper/types';
import axios from 'axios';
import { Request, Response } from 'express';
import error from '../../errors/genenric_error.js';

export default async function getLobbyState(req: Request, resp: Response) {
  try {
    const goResp = await axios.get('http://localhost:6900/lobby');

    resp.status(200).json(goResp.data as Partial<IPlayer>[]);
  } catch (err) {
    console.error(err);
    resp.status(500).json(error('Error getting lobby state', err as Error));
  }
}
