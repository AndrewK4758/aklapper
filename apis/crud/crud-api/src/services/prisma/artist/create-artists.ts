import { prisma } from '@aklapper/prisma';
import { artist } from '@prisma/client';
import type { PrismaClientKnownRequestError } from '@prisma/client/runtime/library.js';

/**
 * This function creates a new artist in the database.
 *
 * @param name - The name of the artist to be created.
 * @returns A Promise that resolves to the newly created artist object, or BuiltErrorMessage if an error occurs.
 */

const createArtists = async (name: string): Promise<artist | PrismaClientKnownRequestError> => {
  try {
    return prisma.artist.create({ data: { name: name } });
  } catch (err) {
    return err as PrismaClientKnownRequestError;
  }
};

export default createArtists;
