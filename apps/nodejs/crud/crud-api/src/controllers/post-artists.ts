import type { Request, Response } from 'express';
import createArtists from '../services/prisma/artist/create-artists.js';

/**
 * Handles POST requests to create a new artist in the database.
 *
 * @param req - The Express request object containing the artist name in the request body.
 * @param resp - The Express response object used to send the response back to the client.
 * @returns No explicit return value. It sends a JSON response indicating success or failure, along with a success message or an error message.
 */

const postArtists = async (req: Request, resp: Response): Promise<void> => {
  const { name } = req.body;
  try {
    const newArtist = await createArtists(name);
    resp.status(201).json({ message: 'Artist Created Sucessful', value: newArtist });
  } catch (error) {
    console.error(error);
    resp.status(500).json(error);
  }
};

export default postArtists;
