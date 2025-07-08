import { prisma, PrismaErrorLogger, type artist, type PrismaClientErrors } from '@aklapper/chinook-client';

/**
 * This function deletes an artist from the database by their ID.
 *
 * @param id - The ID of the artist to delete.
 * @returns A Promise that resolves to the deleted artist object, or null if an error occurs.
 */

const deleteArtists = async (id: number): Promise<artist> => {
  try {
    return prisma.artist.delete({ where: { artist_id: id } });
  } catch (error) {
    const prismaError = new PrismaErrorLogger(error as PrismaClientErrors);
    throw prismaError.parseErrors();
  }
};

export default deleteArtists;
