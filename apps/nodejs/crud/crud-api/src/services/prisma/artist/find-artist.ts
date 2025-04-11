import { prisma, PrismaErrorLogger, type ParsedPrismaError, type PrismaClientErrors } from '@aklapper/chinook-client';
import type { artist } from 'node_modules/@aklapper/chinook-client/generated/client.js';

/**
 * Finds an artist in the database by their ID.
 *
 * @param id - The ID of the artist to find.
 * @returns A Promise that resolves to the artist object if found, otherwise null.
 */

const findArtist = async (id: number): Promise<(artist | null) | ParsedPrismaError> => {
  try {
    return await prisma.artist.findUnique({ where: { artist_id: id }, include: { album: true } });
  } catch (error) {
    const prismaError = new PrismaErrorLogger(error as PrismaClientErrors);
    return prismaError.parseErrors();
  }
};

export default findArtist;
