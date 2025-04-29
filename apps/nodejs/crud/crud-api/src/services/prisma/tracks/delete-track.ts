import {
  PrismaErrorLogger,
  type ParsedPrismaError,
  type Prisma,
  type PrismaClientErrors,
  type track,
} from '@aklapper/chinook-client';
import type { DefaultArgs } from '@prisma/client/runtime/library';
import prisma from '../client/prisma_client.js';

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
