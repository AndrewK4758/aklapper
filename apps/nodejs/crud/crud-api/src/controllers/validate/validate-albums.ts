import { Prisma } from '@aklapper/chinook-client';
import { type CRUD_BlurResponse, BlurResponse, CRUD_ValidationCategory } from '@aklapper/types';
import type { NextFunction, Request, Response } from 'express';
import validateAlbum from '../../services/prisma/album/validate-album.js';

/**
 * Middleware function that validates if an album exists in the database.
 *
 * This function checks if the `title` query parameter is present in the request. If it is, it extracts the `artistID` and `title` from the query parameters and constructs a Prisma query to check if an album with the given title and artist ID exists. It then sends a JSON response indicating whether the album exists or not. If the `title` parameter is not present, it calls the `next()` middleware function to continue processing the request.
 *
 * @param req - The Express request object.
 * @param resp - The Express response object.
 * @param next - The next middleware function in the chain.
 * @returns No explicit return value. It either sends a JSON response indicating album existence or calls the `next()` middleware function.
 */

const validateAlbums = async (req: Request, resp: Response, next: NextFunction) => {
  if (req.params.category === CRUD_ValidationCategory.ALBUMS) {
    try {
      const { title } = req.query;

      const query = {
        where: {
          title: { equals: title as string, mode: 'insensitive' },
        },
      } as Prisma.albumWhereInput;

      const album = await validateAlbum(query);

      if (album) {
        const blurResp: CRUD_BlurResponse = {
          message: 'Album Already Exists',
          status: BlurResponse.ERROR,
        };

        resp.status(200).json(blurResp);
      } else {
        const blurResp: CRUD_BlurResponse = {
          message: 'Album Not in List',
          status: BlurResponse.AVAILABLE,
        };

        resp.status(200).json(blurResp);
      }
    } catch (error) {
      console.error(error);
      resp.status(500).json(error);
    }
  } else {
    next();
  }
};

export default validateAlbums;
