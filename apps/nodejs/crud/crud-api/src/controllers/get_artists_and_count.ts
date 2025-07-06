import type { NextFunction, Request, Response } from 'express';
import getArtistsAndCount, { type ArtistPagination } from 'src/services/prisma/artist/get_artists_and_count.js';

export default async function artistsAndCount(req: Request, resp: Response, next: NextFunction) {
  if (!req.query.take && !req.query.skip && !req.query.cursor) next();

  try {
    const { take, skip, cursor } = req.query as ArtistPagination;

    const { data, count } = await getArtistsAndCount({ take, skip, cursor });

    resp.status(200).json({ data, count });
  } catch (error) {
    console.error(error);
  }
}
