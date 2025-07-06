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

const getArtistsAlbums = async (req: Request, resp: Response): Promise<void> => {
  try {
    const artistID = req.params.id;
    const { cursor, skip, take } = req.query;

    console.log('ARTIST ID: ', artistID);
    console.log(cursor, skip, take);

    const query = {
      where: { artist_id: parseInt(artistID, 10) },
    } as Prisma.albumFindManyArgs<DefaultArgs>;

    const { count, data } = await getArtistAlbums(query);

    const respData: CRUD_ApiResponse<{ count: number; data: album[] }> = {
      message: 'Arist Albums found',
      value: { count, data },
    };
    resp.status(200).json(respData);
  } catch (error) {
    console.error(error);
    resp.status(500).json(error);
  }
};

export default getArtistsAlbums;
