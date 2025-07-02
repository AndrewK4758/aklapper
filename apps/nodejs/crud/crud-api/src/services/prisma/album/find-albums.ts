import {
  prisma,
  Prisma,
  PrismaErrorLogger,
  type album,
  type ParsedPrismaError,
  type PrismaClientErrors,
} from '@aklapper/chinook-client';
import type { DefaultArgs } from '@prisma/client/runtime/library';
/**
 * This function retrieves all albums from the database based on the provided query.
 *
 * @param query - An object containing the query parameters for filtering and sorting albums.
 * @returns A Promise that resolves to an array of album objects, or null if an error occurs.
 */

const findAllAlbums = async (query: Prisma.albumFindManyArgs<DefaultArgs>): Promise<album[] | ParsedPrismaError> => {
  try {
    return await prisma.album.findMany(query);
  } catch (error) {
    const prismaError = new PrismaErrorLogger(error as PrismaClientErrors);
    return prismaError.parseErrors();
  }
};

export default findAllAlbums;
