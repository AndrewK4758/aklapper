import { prisma, Prisma, PrismaErrorLogger, type album, type PrismaClientErrors } from '@aklapper/chinook-client';
import type { DefaultArgs } from '@prisma/client/runtime/library';
/**
 * This function retrieves all albums from the database based on the provided query.
 *
 * @param query - An object containing the query parameters for filtering and sorting albums.
 * @returns A Promise that resolves to an array of album objects, or null if an error occurs.
 */

const findAllAlbums = async (
  query: Prisma.albumFindManyArgs<DefaultArgs>,
): Promise<{ count: number; data: album[] }> => {
  try {
    const [count, data] = await prisma.$transaction([prisma.album.count(), prisma.album.findMany(query)]);

    return { count, data };
  } catch (error) {
    const prismaError = new PrismaErrorLogger(error as PrismaClientErrors);
    throw prismaError.parseErrors();
  }
};

export default findAllAlbums;
