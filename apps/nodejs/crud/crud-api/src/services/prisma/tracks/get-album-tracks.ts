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
 *
 * @param {Prisma.trackFindManyArgs<DefaultArgs>} query - The Prisma query object to get all tracks on a specific album
 * @returns {Promsie<track[]>} - A Promise that resolves to an array of tracks or null if none exist
 */

const getAlbumTracks = async (query: Prisma.trackFindManyArgs<DefaultArgs>): Promise<track[]> => {
  try {
    return await prisma.track.findMany(query);
  } catch (error) {
    const prismaError = new PrismaErrorLogger(error as PrismaClientErrors);
    throw prismaError.parseErrors();
  }
};

export default getAlbumTracks;
