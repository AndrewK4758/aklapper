import type { Prisma } from '@aklapper/chinook-client';
import { type CRUD_BlurResponse, BlurResponse, CRUD_ValidationCategory } from '@aklapper/types';
import type { NextFunction, Request, Response } from 'express';
import validateTrack from '../../services/prisma/tracks/validate-track.js';

/**
 * Handles GET requests to validate if a track exists within a specific album in the database.
 *
 * This function extracts the `albumID` and `name` query parameters from the request. It constructs a Prisma query to check if a track with the given name exists within the specified album. It then sends a JSON response indicating whether the track exists or not.
 *
 * @param req - The Express request object.
 * @param resp - The Express response object.
 * @returns No explicit return value. It sends a JSON response indicating track existence within the album.
 */

const validateTracks = async (req: Request, resp: Response, next: NextFunction) => {
  if (req.params.category === CRUD_ValidationCategory.TRACKS) {
    try {
      const { albumID, name } = req.query;

      const query = {
        where: {
          album_id: { equals: parseInt(albumID as string, 10) },
          name: { equals: `${name}` as string },
        },
      } as Prisma.trackWhereInput;

      const track = await validateTrack(query);

      if (track) {
        const blurResp: CRUD_BlurResponse = {
          message: 'Track Already Exists',
          status: BlurResponse.ERROR,
        };

        resp.status(200).json(blurResp);
      } else {
        const blurResp: CRUD_BlurResponse = {
          message: 'Track Not in Album',
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

export default validateTracks;
