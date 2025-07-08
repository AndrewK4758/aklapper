import type { artist } from '@aklapper/chinook-client';
import type { CRUD_ApiResponse } from '@aklapper/types';
import type { NextFunction, Request, Response } from 'express';
import getArtistsAndCount, { type ArtistPagination } from '../../services/prisma/artist/get_artists_and_count.js';

export default async function artistsAndCount(req: Request, resp: Response, next: NextFunction) {
  if (!req.query.take && !req.query.skip && !req.query.cursor) next();

  try {
    const { take, skip, cursor } = req.query as ArtistPagination;

    const { data, count } = await getArtistsAndCount({ take, skip, cursor });

    const artistsResp: CRUD_ApiResponse<artist[]> = {
      message: `Artists received`,
      count: count,
      data: data,
    };

    resp.status(200).json(artistsResp);
  } catch (error) {
    console.error(error);
  }
}
