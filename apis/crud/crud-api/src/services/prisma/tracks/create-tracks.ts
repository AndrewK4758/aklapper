import { prisma } from '@aklapper/prisma';
import { PrismaErrorLogger, type ParsedPrismaError, type PrismaClientErrors } from '@aklapper/prisma';
import { Prisma, type track } from '@prisma/client';
import { DefaultArgs } from '@prisma/client/runtime/library';

/**
 * Creates a new track in the database.
 *
 * @param query - The Prisma query object for creating the track.
 * @returns A Promise that resolves to the newly created track, or null if an error occurs.
 */

const createTracks = async (query: Prisma.trackCreateArgs<DefaultArgs>): Promise<track | ParsedPrismaError> => {
  try {
    return await prisma.track.create(query);
  } catch (error) {
    const prismaError = new PrismaErrorLogger(error as PrismaClientErrors);
    return prismaError.parseErrors();
  }
};

export default createTracks;
