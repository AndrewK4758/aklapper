import {
  PrismaErrorLogger,
  type ParsedPrismaError,
  type Prisma,
  type PrismaClientErrors,
} from '@aklapper/chinook-client';
import prisma from '../client/prisma_client.js';
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
