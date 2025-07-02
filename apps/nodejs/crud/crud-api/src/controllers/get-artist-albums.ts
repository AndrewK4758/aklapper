import { Prisma, type album } from '@aklapper/chinook-client';
import type { CRUD_ApiResponse } from '@aklapper/types';
import type { DefaultArgs } from '@prisma/client/runtime/library';
import type { NextFunction, Request, Response } from 'express';
import getArtistAlbums from '../services/prisma/album/get-artist-albums.js';

/**
 * Middleware function that retrieves albums for a specific artist.
 *
 * This function checks if the `title` query parameter is NOT present and the `artistID` query parameter IS present. If these conditions are met, it retrieves the `artistID` from the query parameters, fetches the albums associated with that artist from the database using Prisma, and sends the albums as a JSON response. If the conditions are not met, it calls the `next()` middleware function to continue processing the request.
 *
 * @param req - The Express request object.
 * @param resp - The Express response object.
 * @param next - The next middleware function in the chain.
 * @returns No explicit return value. It either sends a JSON response with the artist's albums or calls the `next()` middleware function.
 */

const getArtistsAlbums = async (req: Request, resp: Response, next: NextFunction): Promise<void> => {
  if (!req.query.title && req.query.artistID) {
    try {
      const { cursor, skip, take } = req.query;

      const artistID = parseInt(req.query.artistID as string, 10);

      const query = {
        take: parseInt(take as string, 10),
        skip: parseInt(skip as string, 10),
        cursor: { album_id: parseInt(cursor as string, 10) },
        where: { artist_id: artistID },
      } as Prisma.albumFindManyArgs<DefaultArgs>;

      const albums = await getArtistAlbums(query);

      const data: CRUD_ApiResponse<album[]> = {
        message: 'Arist Albums found',
        value: albums,
      };
      resp.status(200).json(data);
    } catch (error) {
      console.error(error);
      resp.status(500).json(error);
    }
  } else next();
};

export default getArtistsAlbums;
