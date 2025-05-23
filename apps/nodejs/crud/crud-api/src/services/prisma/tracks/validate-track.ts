import { Prisma, PrismaErrorLogger, type ParsedPrismaError, type PrismaClientErrors } from '@aklapper/chinook-client';
import prisma from '../client/prisma_client.js';

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
