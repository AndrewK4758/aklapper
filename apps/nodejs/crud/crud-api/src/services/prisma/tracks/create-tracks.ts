import { prisma, PrismaErrorLogger, type ParsedPrismaError, type PrismaClientErrors } from '@aklapper/chinook-client';
import type { DefaultArgs } from '@prisma/client/runtime/library';
import { Prisma, type track } from 'node_modules/@aklapper/chinook-client/generated/client.js';

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
