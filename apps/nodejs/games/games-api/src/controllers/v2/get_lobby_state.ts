// import type { IPlayer } from '@aklapper/types';
import type { ClientLobbyData } from '@aklapper/types';
import axios from 'axios';
import type { Request, Response } from 'express';
import error from '../../errors/genenric_error.js';

export default async function getLobbyState(_req: Request, resp: Response) {
  try {
    const goResp = await axios.get('http://localhost:6900/lobby');

    const { activePlayersInLobby, activeGamesInLobby } = goResp.data as ClientLobbyData;

    resp.status(200).json({
      activeGamesInLobby: activeGamesInLobby ?? [],
      activePlayersInLobby: activePlayersInLobby ?? [],
    });
  } catch (err) {
    console.error(err);
    resp.status(500).json(error('Error getting lobby state', err as Error));
  }
}
