import { prisma } from '@aklapper/prisma';
import { PrismaErrorLogger, type ParsedPrismaError, type PrismaClientErrors } from '@aklapper/prisma';
import type { Prisma } from '@prisma/client';

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
