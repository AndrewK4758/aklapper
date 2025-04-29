import { PrismaErrorLogger, type artist, type PrismaClientErrors } from '@aklapper/chinook-client';
import prisma from '../client/prisma_client.js';
/**
 * Updates an existing artist in the database.
 *
 * @param artist_id - The ID of the artist to update.
 * @param name - The new name of the artist.
 * @returns A Promise that resolves to the updated artist object, or null if an error occurs.
 */

const updateArtist = async (artist_id: number, name: string): Promise<artist> => {
  try {
    return await prisma.artist.update({ where: { artist_id: artist_id }, data: { name: name } });
  } catch (error) {
    const prismaError = new PrismaErrorLogger(error as PrismaClientErrors);
    throw prismaError.parseErrors();
  }
};

export default updateArtist;
