import { Prisma, PrismaErrorLogger, prisma, type PrismaClientErrors, type album } from '@aklapper/chinook-client';
import type { DefaultArgs } from '@prisma/client/runtime/library';

/**
 * This function retrieves a list of albums for a specific artist from the database.
 *
 * @param query - An object containing the query parameters for filtering albums (e.g., artist ID).
 * @returns A Promise that resolves to an array of album objects for the specified artist, or null if an error occurs.
 */

const getArtistAlbums = async (query: Prisma.albumFindManyArgs<DefaultArgs>): Promise<{ data: album[] }> => {
  try {
    const data = await prisma.album.findMany(query);

    return { data };
  } catch (error) {
    const prismaError = new PrismaErrorLogger(error as PrismaClientErrors);
    throw prismaError.parseErrors();
  }
};

export default getArtistAlbums;
