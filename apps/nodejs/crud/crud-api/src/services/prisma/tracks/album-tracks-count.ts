import { PrismaErrorLogger, type ParsedPrismaError, type PrismaClientErrors } from '@aklapper/chinook-client';
import prisma from '../client/prisma_client.js';

/**
 * Counts the number of tracks in a given album.
 *
 * @param albumID - The ID of the album.
 * @returns A Promise that resolves to the number of tracks, or null if an error occurs.
 */

const albumTracksCount = async (albumID: number): Promise<number> => {
  try {
    return await prisma.track.count({ where: { album_id: { equals: albumID } } });
  } catch (error) {
    const prismaError = new PrismaErrorLogger(error as PrismaClientErrors);
    throw prismaError.parseErrors();
  }
};

export default albumTracksCount;
