import { prisma, PrismaErrorLogger, type ParsedPrismaError, type PrismaClientErrors } from '@aklapper/prisma';
import { Prisma, type artist } from '@prisma/client-generated';
import { DefaultArgs } from '@prisma/client-generated/runtime/library';
/**
 * Searches for artists in the database based on the provided query.
 *
 * @param query - An object containing the Prisma query parameters for filtering and sorting artists. This allows you to specify criteria such as name, artist ID, etc.
 *
 * @returns A Promise that resolves to an array of `artist` objects if the search is successful, `null` if an error occurs.
 */

const searchArtist = async (
  query: Prisma.artistFindManyArgs<DefaultArgs>
): Promise<(artist[] | null) | ParsedPrismaError> => {
  try {
    return await prisma.artist.findMany(query);
  } catch (error) {
    const prismaError = new PrismaErrorLogger(error as PrismaClientErrors);
    return prismaError.parseErrors();
  }
};

export default searchArtist;
