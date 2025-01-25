import { prisma } from '@aklapper/prisma';
import { PrismaErrorLogger, type ParsedPrismaError, type PrismaClientErrors } from '@aklapper/prisma';
import { Prisma, type track } from '@prisma/client';
import { DefaultArgs } from '@prisma/client/runtime/library';

/**
 * Deletes a track from the database.
 *
 * @param query - The Prisma query for deleting the track.
 * @returns A Promise that resolves to the deleted track, or null if an error occurs.
 */

const deleteTrack = async (query: Prisma.trackDeleteArgs<DefaultArgs>): Promise<track | ParsedPrismaError> => {
  try {
    return await prisma.track.delete(query);
  } catch (error) {
    const prismaError = new PrismaErrorLogger(error as PrismaClientErrors);
    return prismaError.parseErrors();
  }
};

export default deleteTrack;
