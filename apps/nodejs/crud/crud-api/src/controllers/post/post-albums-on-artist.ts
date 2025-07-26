import type { album } from '@aklapper/chinook-client';
import type { CRUD_ApiResponse } from '@aklapper/types';
import type { Request, Response } from 'express';
import createAlbumOnArtist from '../../services/prisma/album/create-albums_on_artist.js';

/**
 * This function handles POST requests to add a new album to an existing artist.
 *
 * @param req - The Express request object, which should contain the artist ID in the URL parameters and the album title in the request body.
 * @param res - The Express response object, used to send the response back to the client.
 * @returns No explicit return value. It sends a JSON response indicating success or failure, along with the new album data or an error message.
 */

const createAlbumsOnArtists = async (req: Request, resp: Response) => {
  try {
    const { artistID, title } = req.body;

    const newAlbum = await createAlbumOnArtist(parseInt(artistID, 10), title);

    const postResp: CRUD_ApiResponse<album> = {
      type: 'client',
      message: 'Album Created',
      data: newAlbum,
    };

    resp.status(200).json(postResp);
  } catch (error) {
    console.error(error);
    resp.status(500).json(error);
  }
};

export default createAlbumsOnArtists;
