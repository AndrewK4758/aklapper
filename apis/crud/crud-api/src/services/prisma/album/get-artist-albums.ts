import { prisma } from '@aklapper/prisma';
import { PrismaErrorLogger, type ParsedPrismaError, type PrismaClientErrors } from '@aklapper/prisma';
import { Prisma, type album } from '@prisma/client-generated';
import { DefaultArgs } from '@prisma/client-generated/runtime/library';

/**
 * This function retrieves a list of albums for a specific artist from the database.
 *
 * @param query - An object containing the query parameters for filtering albums (e.g., artist ID).
 * @returns A Promise that resolves to an array of album objects for the specified artist, or null if an error occurs.
 */

const getArtistAlbums = async (query: Prisma.albumFindManyArgs<DefaultArgs>): Promise<album[] | ParsedPrismaError> => {
  try {
    return await prisma.album.findMany(query);
  } catch (error) {
    const prismaError = new PrismaErrorLogger(error as PrismaClientErrors);
    return prismaError.parseErrors();
  }
};

export default getArtistAlbums;
