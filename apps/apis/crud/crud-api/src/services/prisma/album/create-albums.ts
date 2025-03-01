import { prisma } from '@aklapper/prisma';
import { PrismaErrorLogger, type PrismaClientErrors, type ParsedPrismaError } from '@aklapper/prisma';
import type { album } from '@prisma/client';
/**
 * Creates a new album in the database.
 *
 * @param artistID - The ID of the artist to associate the album with.
 * @param title - The title of the album.
 * @returns A Promise that resolves to the newly created album object, or null if an error occurs.
 */

const createAlbum = async (artistID: number, title: string): Promise<album | ParsedPrismaError> => {
  try {
    return await prisma.album.create({ data: { artist_id: artistID, title: title } });
  } catch (error) {
    const prismaError = new PrismaErrorLogger(error as PrismaClientErrors);
    return prismaError.parseErrors();
  }
};

export default createAlbum;
