import { PrismaErrorLogger, type artist, type Prisma, type PrismaClientErrors } from '@aklapper/chinook-client';
import type { DefaultArgs } from '@prisma/client/runtime/library';
import prisma from '../client/prisma_client.js';
/**
 * This function retrieves a list of artists from the database based on the provided query.
 *
 * @param query - An object containing the query parameters for filtering and sorting artists.
 * @returns A Promise that resolves to an array of artist objects, or null if an error occurs.
 */

//
const findArtists = async (query: Prisma.artistFindManyArgs<DefaultArgs>): Promise<artist[]> => {
  try {
    return await prisma.artist.findMany(query);
  } catch (error) {
    const prismaError = new PrismaErrorLogger(error as PrismaClientErrors);
    throw prismaError.parseErrors();
  }
};

export default findArtists;
