import { prisma } from '@aklapper/chinook-client';
import { PrismaErrorLogger, type ParsedPrismaError, type PrismaClientErrors } from '@aklapper/chinook-client';
import type { Prisma } from 'node_modules/@aklapper/chinook-client/generated/client.js';

/**
 * This function checks if an artist exists in the database based on the provided query.
 *
 * @param query - An object containing the query parameters for filtering artists.
 * @returns A Promise that resolves to true if an artist matching the query exists, false otherwise, or null if an error occurs.
 */

const validateArtist = async (query: Prisma.artistWhereInput): Promise<boolean | ParsedPrismaError> => {
  try {
    return await prisma.artist.exists(query);
  } catch (error) {
    const prismaError = new PrismaErrorLogger(error as PrismaClientErrors);
    return prismaError.parseErrors();
  }
};

export default validateArtist;
