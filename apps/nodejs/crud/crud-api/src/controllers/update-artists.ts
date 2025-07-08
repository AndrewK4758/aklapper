import type { artist } from '@aklapper/chinook-client';
import type { CRUD_ApiResponse } from '@aklapper/types';
import type { Request, Response } from 'express';
import updateArtist from '../services/prisma/artist/update-artists.js';

/**
 * Handles PATCH requests to update an artist in the database.
 *
 * @param req - The Express request object containing the artist ID and new name in the request body.
 * @param resp - The Express response object used to send the response back to the client.
 * @returns No explicit return value. It sends a JSON response indicating success or failure, along with the updated artist data or an error message.
 */

const updateArtists = async (req: Request, resp: Response): Promise<void> => {
  try {
    const { artist_id, name } = req.body;

    const updatedArtist = await updateArtist(artist_id, name);

    const updateResp: CRUD_ApiResponse<artist> = {
      message: `Artist ID: ${artist_id} updated`,
      data: updatedArtist,
    };

    resp.status(202).json(updateResp);
  } catch (error) {
    console.error(error);
    resp.status(500).json(error);
  }
};

export default updateArtists;
