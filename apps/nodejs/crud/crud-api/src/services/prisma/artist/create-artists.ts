import { prisma, PrismaErrorLogger, type PrismaClientErrors } from '@aklapper/chinook-client';
import { type artist } from '@aklapper/chinook-client/prisma';

/**
 * This function creates a new artist in the database.
 *
 * @param name - The name of the artist to be created.
 * @returns A Promise that resolves to the newly created artist object, or BuiltErrorMessage if an error occurs.
 */

const createArtists = async (name: string): Promise<artist> => {
  try {
    return await prisma.artist.create({ data: { name: name } });
  } catch (error) {
    const prismaError = new PrismaErrorLogger(error as PrismaClientErrors);
    throw prismaError;
  }
};

export default createArtists;
