import type { Prisma } from 'node_modules/@aklapper/chinook-client/generated/client.js';
import type { Request, Response } from 'express';
import validateArtist from '../services/prisma/artist/validate-artist-in-db.js';

/**
 * Handles GET requests to validate if an artist exists in the database.
 *
 * This function extracts the `name` query parameter from the request and constructs a Prisma query to check if an artist with the given name exists. It then sends a JSON response indicating whether the artist exists or not.
 *
 * @param req - The Express request object.
 * @param resp - The Express response object.
 * @returns No explicit return value. It sends a JSON response indicating artist existence.
 */

const validateArtists = async (req: Request, resp: Response) => {
  try {
    const { name } = req.query;

    const query = {
      where: { name: { equals: name as string, mode: 'insensitive' } },
    } as Prisma.artistWhereInput;

    const artist = await validateArtist(query);

    if (artist) resp.status(200).json({ message: 'Artist Already Exists' });
    else resp.status(200).json({ message: 'Artist Not in List' });
  } catch (error) {
    console.error(error);
    resp.status(500).json(error);
  }
};

export default validateArtists;
