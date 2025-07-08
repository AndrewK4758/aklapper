import type { track } from '@aklapper/chinook-client';
import type { CRUD_ApiResponse } from '@aklapper/types';
import type { Request, Response } from 'express';
import updateTrack from '../services/prisma/tracks/update-track.js';

/**
 * Handles PATCH requests to update a track in the database.
 *
 * @param req - The Express request object containing the track data in the request body.
 * @param resp - The Express response object used to send the response back to the client.
 * @returns No explicit return value. It sends a JSON response indicating success or failure, along with the updated track data or an error message.
 */

const updateTracks = async (req: Request, resp: Response) => {
  try {
    const { trackData } = req.body as { trackData: track };

    const updatedTrack = await updateTrack(trackData);

    const updatedResp: CRUD_ApiResponse<track> = {
      message: `Track ID: ${trackData.track_id} updated`,
      data: updatedTrack,
    };

    resp.status(200).json(updatedResp);
  } catch (error) {
    console.error(error);
    resp.status(500).json(error);
  }
};
export default updateTracks;
