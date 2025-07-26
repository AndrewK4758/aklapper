import type { artist } from '@aklapper/chinook-client';
import type { CRUD_ApiResponse, QueryOptions } from '@aklapper/types';
import type { Request, Response } from 'express';
import getArtistsAndCount from '../../services/prisma/artist/get_artists_and_count.js';

export default async function artistsAndCount(req: Request, resp: Response) {
  try {
    const { take, cursor } = req.query as QueryOptions;

    const { data, count } = await getArtistsAndCount({ take, cursor });

    const artistsResp: CRUD_ApiResponse<artist[]> = {
      type: 'server',
      message: `Artists received`,
      count: count,
      data: data,
    };

    resp.status(200).json(artistsResp);
  } catch (error) {
    console.error(error);

    const errorResp = {
      message: 'Artists & Count Server Error',
      count: 0,
      data: error as Error,
    };
    resp.status(500).json(errorResp);
  }
}
