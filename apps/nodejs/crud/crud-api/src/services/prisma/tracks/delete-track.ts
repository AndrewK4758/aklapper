import { PrismaErrorLogger, prisma, type Prisma, type PrismaClientErrors, type track } from '@aklapper/chinook-client';
import type { DefaultArgs } from '@prisma/client/runtime/library';

/**
 * Deletes a track from the database.
 *
 * @param query - The Prisma query for deleting the track.
 * @returns A Promise that resolves to the deleted track, or null if an error occurs.
 */

const deleteTrack = async (query: Prisma.trackDeleteArgs<DefaultArgs>): Promise<track> => {
  try {
    return await prisma.track.delete(query);
  } catch (error) {
    const prismaError = new PrismaErrorLogger(error as PrismaClientErrors);
    throw prismaError.parseErrors();
  }
};

export default deleteTrack;
