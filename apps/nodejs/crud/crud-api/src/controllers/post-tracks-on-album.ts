import type { DefaultArgs } from '@prisma/client/runtime/library';
import type { Request, Response } from 'express';
import { Prisma } from 'node_modules/@aklapper/chinook-client/generated/client.js';
import createTracks from '../services/prisma/tracks/create-tracks.js';

/**
 * Handles POST requests to create a new track and associate it with an album.
 *
 * @param req - The Express request object containing the track name and album ID in the request body.
 * @param resp - The Express response object used to send the response back to the client.
 * @returns No explicit return value. It sends a JSON response indicating success or failure, along with the new track data or an error message.
 */

const createTracksOnAlbum = async (req: Request, resp: Response) => {
  try {
    const { name, albumID } = req.body;

    const query = {
      data: { name: name, album_id: albumID },
    } as Prisma.trackCreateArgs<DefaultArgs>;

    const newTrack = await createTracks(query);

    resp.status(200).json({ newTrack: newTrack });
  } catch (error) {
    console.error(error);
    resp.status(500).json(error);
  }
};

export default createTracksOnAlbum;
