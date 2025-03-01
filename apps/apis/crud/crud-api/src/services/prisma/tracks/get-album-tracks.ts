import { prisma } from '@aklapper/prisma';
import { PrismaErrorLogger, type ParsedPrismaError, type PrismaClientErrors } from '@aklapper/prisma';
import { Prisma, type track } from '@prisma/client';
import { DefaultArgs } from '@prisma/client/runtime/library';
/**
 *
 * @param {Prisma.trackFindManyArgs<DefaultArgs>} query - The Prisma query object to get all tracks on a specific album
 * @returns {Promsie<track[]>} - A Promise that resolves to an array of tracks or null if none exist
 */

const getAlbumTracks = async (query: Prisma.trackFindManyArgs<DefaultArgs>): Promise<track[] | ParsedPrismaError> => {
  try {
    return await prisma.track.findMany(query);
  } catch (error) {
    const prismaError = new PrismaErrorLogger(error as PrismaClientErrors);
    return prismaError.parseErrors();
  }
};

export default getAlbumTracks;
