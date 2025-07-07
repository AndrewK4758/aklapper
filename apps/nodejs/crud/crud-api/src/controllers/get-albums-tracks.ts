import { Prisma, type track } from '@aklapper/chinook-client';
import type { CRUD_ApiResponse } from '@aklapper/types';
import type { DefaultArgs } from '@prisma/client/runtime/library';
import type { NextFunction, Request, Response } from 'express';
import getAlbumTracks from '../services/prisma/tracks/get-album-tracks.js';

/**
 * Middleware function that retrieves tracks for an album and their count.
 *
 * This function checks if the `name` query parameter is present. If it is, it passes control to the next middleware function. Otherwise, it retrieves the `albumID` from the query parameters, fetches the tracks associated with that album from the database using Prisma, counts the tracks, and sends the tracks and their count as a JSON response.
 *
 * @param req - The Express request object.
 * @param resp - The Express response object.
 * @param next - The next middleware function in the chain.
 * @returns No explicit return value. It either sends a JSON response with the tracks and their count or calls the `next()` middleware function.
 */

const getAlbumsTracks = async (req: Request, resp: Response, next: NextFunction) => {
  if (req.query.albumID) {
    try {
      const albumID = parseInt(req.query.albumID as string, 10);

      const query = {
        where: { album_id: albumID },
      } as Prisma.trackFindManyArgs<DefaultArgs>;

      const tracks = await getAlbumTracks(query);

      const data: CRUD_ApiResponse<track[]> = { message: 'Albums Tracks sucessful', data: tracks };

      resp.status(200).json(data);
    } catch (error) {
      console.error(error);
      resp.status(500).json(error);
    }
  } else next();
};

export default getAlbumsTracks;
