import { Request, Response } from 'express';
import PrismaErrorLogger, { ParsedPrismaError } from '../errors/log-error.js';
import createArtists from '../services/prisma/artist/create-artists.js';
import type { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

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
    resp.status(201).json({ message: 'Artist Created Sucessful', newArtist: newArtist });
  } catch (error) {
    const prismeError = new PrismaErrorLogger(error as PrismaClientKnownRequestError);
    console.log(prismeError.displayError(), 'IN POST RETURN CATCH DISPLAY ERROR');
    resp.status(400).json(prismeError.displayError() as ParsedPrismaError);
  }
};

export default postArtists;
