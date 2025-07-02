import { Prisma, type track } from '@aklapper/chinook-client';
import type { CRUD_ApiResponse } from '@aklapper/types';
import type { DefaultArgs } from '@prisma/client/runtime/library';
import type { Request, Response } from 'express';
import deleteTrack from '../services/prisma/tracks/delete-track.js';

/**
 * Handles DELETE requests to delete a track from the database.
 *
 * @param req - The Express request object containing the track ID in the URL parameters.
 * @param resp - The Express response object used to send the response back to the client.
 * @returns No explicit return value. It sends a JSON response indicating success or failure, along with the deleted track data or an error message.
 */

const deleteTracks = async (req: Request, resp: Response) => {
  try {
    const { id } = req.params;

    const query: Prisma.trackDeleteArgs<DefaultArgs> = {
      where: { track_id: parseInt(id, 10) },
    };
    const deletedTrack = await deleteTrack(query);

    const data: CRUD_ApiResponse<track> = { message: `Track ID: ${id} deleted`, value: deletedTrack };
    resp.status(200).json(data);
  } catch (error) {
    console.error(error);
    resp.status(500).json(error);
  }
};

export default deleteTracks;
