import {
  PrismaErrorLogger,
  type ParsedPrismaError,
  type PrismaClientErrors,
  type album,
} from '@aklapper/chinook-client';
import prisma from '../client/prisma_client.js';

/**
 * Deletes an album from the database by its ID.
 *
 * @param albumID - The ID of the album to delete.
 * @returns A Promise that resolves to the deleted album object, or null if an error occurs.
 */

const deleteArtistAlbums = async (albumID: number): Promise<album> => {
  try {
    return await prisma.album.delete({ where: { album_id: albumID } });
  } catch (error) {
    const prismaError = new PrismaErrorLogger(error as PrismaClientErrors);
    throw prismaError.parseErrors();
  }
};

export default deleteArtistAlbums;
