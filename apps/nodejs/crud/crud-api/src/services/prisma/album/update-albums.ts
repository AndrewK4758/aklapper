import { prisma } from '@aklapper/chinook-client';
import { PrismaErrorLogger, type ParsedPrismaError, type PrismaClientErrors } from '@aklapper/chinook-client';
import type { album } from 'node_modules/@aklapper/chinook-client/generated/client.js';

/**
 * Updates an existing album in the database.
 *
 * @param albumID - The ID of the album to update.
 * @param title - The new title of the album.
 * @returns A Promise that resolves to the updated album object, or null if an error occurs.
 */

const updateAlbum = async (albumID: number, title: string): Promise<album | ParsedPrismaError> => {
  try {
    return await prisma.album.update({
      where: {
        album_id: albumID
      },
      data: { title: title }
    });
  } catch (error) {
    const prismaError = new PrismaErrorLogger(error as PrismaClientErrors);
    return prismaError.parseErrors();
  }
};

export default updateAlbum;
