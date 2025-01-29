import { prisma, PrismaErrorLogger, type ParsedPrismaError, type PrismaClientErrors } from '@aklapper/prisma';
import { Prisma, type album } from '@prisma/client';
import { DefaultArgs } from '@prisma/client/runtime/library';

/**
 * Searches for albums in the database based on the provided query.
 *
 * @param query - An object containing the Prisma query parameters for filtering and sorting albums. This allows you to specify criteria such as title, artist ID, etc.
 * @returns A Promise that resolves to an array of `album` objects if the search is successful, `null` if an error occurs.
 */

const searchAlbum = async (
  query: Prisma.albumFindManyArgs<DefaultArgs>
): Promise<(album[] | null) | ParsedPrismaError> => {
  try {
    return await prisma.album.findMany(query);
  } catch (error) {
    const prismaError = new PrismaErrorLogger(error as PrismaClientErrors);
    return prismaError.parseErrors();
  }
};

export default searchAlbum;
