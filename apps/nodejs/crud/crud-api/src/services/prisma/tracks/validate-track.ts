import { prisma } from '@aklapper/chinook-client';
import { PrismaErrorLogger, type ParsedPrismaError, type PrismaClientErrors } from '@aklapper/chinook-client';
import { Prisma } from 'node_modules/@aklapper/chinook-client/generated/client.js';

/**
 * Checks if a track exists in the database.
 *
 * @param query - The Prisma query object to filter tracks.
 * @returns A Promise that resolves to true if a track matching the query exists, false otherwise, or null if an error occurs.
 */

const validateTrack = async (query: Prisma.trackWhereInput): Promise<boolean | ParsedPrismaError> => {
  try {
    return await prisma.track.exists(query);
  } catch (error) {
    const prismaError = new PrismaErrorLogger(error as PrismaClientErrors);
    return prismaError.parseErrors();
  }
};

export default validateTrack;
