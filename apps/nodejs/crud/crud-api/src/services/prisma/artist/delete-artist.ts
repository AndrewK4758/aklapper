import { prisma, PrismaErrorLogger, type ParsedPrismaError, type PrismaClientErrors } from '@aklapper/chinook-client';
import type { artist } from 'node_modules/@aklapper/chinook-client/generated/client.js';

/**
 * This function deletes an artist from the database by their ID.
 *
 * @param id - The ID of the artist to delete.
 * @returns A Promise that resolves to the deleted artist object, or null if an error occurs.
 */

const deleteArtists = async (id: number): Promise<artist | ParsedPrismaError> => {
  try {
    return prisma.artist.delete({ where: { artist_id: id } });
  } catch (error) {
    const prismaError = new PrismaErrorLogger(error as PrismaClientErrors);
    return prismaError.parseErrors();
  }
};

export default deleteArtists;
