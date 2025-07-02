import type { ParsedPrismaError, PrismaClientErrors } from '@aklapper/chinook-client';
import { prisma, PrismaErrorLogger } from '@aklapper/chinook-client';
/**
 * Counts the number of albums associated with a specific artist.
 *
 * @param artistID - The ID of the artist.
 * @returns A Promise that resolves to the number of albums for the artist, or null if an error occurs.
 */

const artistAlbumsCount = async (artistID: number): Promise<number | ParsedPrismaError> => {
  try {
    return await prisma.album.count({ where: { artist_id: { equals: artistID } } });
  } catch (err) {
    const prismaError = new PrismaErrorLogger(err as PrismaClientErrors);
    return prismaError.parseErrors();
  }
};

export default artistAlbumsCount;
