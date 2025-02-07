import { prisma } from '@aklapper/prisma';
import { PrismaErrorLogger, type ParsedPrismaError, type PrismaClientErrors } from '@aklapper/prisma';
import { artist, Prisma } from '@prisma/client-generated';
import { DefaultArgs } from '@prisma/client-generated/runtime/library';

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
