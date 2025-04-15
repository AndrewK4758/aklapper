import { prisma, PrismaErrorLogger, type ParsedPrismaError, type PrismaClientErrors } from '@aklapper/chinook-client';
import type { DefaultArgs } from '@prisma/client/runtime/library';
import { Prisma, type artist } from 'node_modules/@aklapper/chinook-client/generated/client.js';

/**
 * This function retrieves a list of artists from the database based on the provided query.
 *
 * @param query - An object containing the query parameters for filtering and sorting artists.
 * @returns A Promise that resolves to an array of artist objects, or null if an error occurs.
 */

const findArtists = async (query: Prisma.artistFindManyArgs<DefaultArgs>): Promise<artist[] | ParsedPrismaError> => {
  try {
    return await prisma.artist.findMany(query);
  } catch (error) {
    const prismaError = new PrismaErrorLogger(error as PrismaClientErrors);
    return prismaError.parseErrors();
  }
};

export default findArtists;
