import { Prisma, PrismaErrorLogger, prisma, type PrismaClientErrors, type track } from '@aklapper/chinook-client';
import type { DefaultArgs } from '@prisma/client/runtime/library';

/**
 * Creates a new track in the database.
 *
 * @param query - The Prisma query object for creating the track.
 * @returns A Promise that resolves to the newly created track, or null if an error occurs.
 */

const createTracks = async (query: Prisma.trackCreateArgs<DefaultArgs>): Promise<track> => {
  try {
    return await prisma.track.create(query);
  } catch (error) {
    const prismaError = new PrismaErrorLogger(error as PrismaClientErrors);
    throw console.error(prismaError.parseErrors());
  }
};

export default createTracks;
