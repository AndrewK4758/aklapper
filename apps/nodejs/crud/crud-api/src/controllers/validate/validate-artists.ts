import type { Prisma } from '@aklapper/chinook-client';
import { BlurResponse, CRUD_ValidationCategory, type CRUD_BlurResponse } from '@aklapper/types';
import type { NextFunction, Request, Response } from 'express';
import validateArtist from '../../services/prisma/artist/validate-artist.js';

/**
 * Handles GET requests to validate if an artist exists in the database.
 *
 * This function extracts the `name` query parameter from the request and constructs a Prisma query to check if an artist with the given name exists. It then sends a JSON response indicating whether the artist exists or not.
 *
 * @param req - The Express request object.
 * @param resp - The Express response object.
 * @returns No explicit return value. It sends a JSON response indicating artist existence.
 */

const validateArtists = async (req: Request, resp: Response, next: NextFunction) => {
  if (req.params.category === CRUD_ValidationCategory.ARTISTS) {
    try {
      const { name } = req.query;

      const query = {
        where: { name: { equals: name as string, mode: 'insensitive' } },
      } as Prisma.artistWhereInput;

      const artist = await validateArtist(query);

      if (artist) {
        const blurResp: CRUD_BlurResponse = {
          message: 'Artist Already Exists',
          status: BlurResponse.ERROR,
        };

        resp.status(200).json(blurResp);
      } else {
        const blurResp: CRUD_BlurResponse = {
          message: 'Artist Not in List',
          status: BlurResponse.AVAILABLE,
        };

        resp.status(200).json(blurResp);
      }
    } catch (error) {
      console.error(error);
      resp.status(500).json(error);
    }
  } else next();
};

export default validateArtists;
