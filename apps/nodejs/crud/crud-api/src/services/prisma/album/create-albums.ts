import { prisma, PrismaErrorLogger, type album, type PrismaClientErrors } from '@aklapper/chinook-client';

/**
 * Creates a new album in the database.
 *
 * @param artistID - The ID of the artist to associate the album with.
 * @param title - The title of the album.
 * @returns A Promise that resolves to the newly created album object, or null if an error occurs.
 */

const createAlbum = async (artistID: number, title: string): Promise<album> => {
  try {
    return await prisma.album.create({ data: { artist_id: artistID, title: title } });
  } catch (error) {
    const prismaError = new PrismaErrorLogger(error as PrismaClientErrors);
    throw prismaError.parseErrors();
  }
};

export default createAlbum;
