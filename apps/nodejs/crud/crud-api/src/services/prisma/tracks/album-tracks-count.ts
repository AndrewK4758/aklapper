import { prisma } from '@aklapper/chinook-client';
import { PrismaErrorLogger, type ParsedPrismaError, type PrismaClientErrors } from '@aklapper/chinook-client';

/**
 * Counts the number of tracks in a given album.
 *
 * @param albumID - The ID of the album.
 * @returns A Promise that resolves to the number of tracks, or null if an error occurs.
 */

const albumTracksCount = async (albumID: number): Promise<number | ParsedPrismaError> => {
  try {
    return await prisma.track.count({ where: { album_id: { equals: albumID } } });
  } catch (error) {
    const prismaError = new PrismaErrorLogger(error as PrismaClientErrors);
    return prismaError.parseErrors();
  }
};

export default albumTracksCount;
