import { prisma } from '@aklapper/prisma';
import { PrismaErrorLogger, type ParsedPrismaError, type PrismaClientErrors } from '@aklapper/prisma';
import { artist } from '@prisma/client';

/**
 * This function creates a new artist in the database.
 *
 * @param name - The name of the artist to be created.
 * @returns A Promise that resolves to the newly created artist object, or BuiltErrorMessage if an error occurs.
 */

const createArtists = async (name: string): Promise<artist | ParsedPrismaError> => {
  try {
    return prisma.artist.create({ data: { name: name } });
  } catch (error) {
    const prismaError = new PrismaErrorLogger(error as PrismaClientErrors);
    return prismaError.parseErrors();
  }
};

export default createArtists;
