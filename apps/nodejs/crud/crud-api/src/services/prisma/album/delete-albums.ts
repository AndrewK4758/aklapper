import { prisma } from '@aklapper/chinook-client';
import { PrismaErrorLogger, type ParsedPrismaError, type PrismaClientErrors } from '@aklapper/chinook-client';
import type { album } from 'node_modules/@aklapper/chinook-client/generated/client.js';

/**
 * Deletes an album from the database by its ID.
 *
 * @param albumID - The ID of the album to delete.
 * @returns A Promise that resolves to the deleted album object, or null if an error occurs.
 */

const deleteArtistAlbums = async (albumID: number): Promise<album | ParsedPrismaError> => {
  try {
    return await prisma.album.delete({ where: { album_id: albumID } });
  } catch (error) {
    const prismaError = new PrismaErrorLogger(error as PrismaClientErrors);
    return prismaError.parseErrors();
  }
};

export default deleteArtistAlbums;
