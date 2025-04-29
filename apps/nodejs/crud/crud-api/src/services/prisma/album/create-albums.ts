import { PrismaErrorLogger, type ParsedPrismaError, type PrismaClientErrors } from '@aklapper/chinook-client';
import type { album } from 'node_modules/@aklapper/chinook-client/generated/client.js';
import prisma from '../client/prisma_client.js';
/**
 * Creates a new album in the database.
 *
 * @param artistID - The ID of the artist to associate the album with.
 * @param title - The title of the album.
 * @returns A Promise that resolves to the newly created album object, or null if an error occurs.
 */

const createAlbum = async (artistID: number, title: string): Promise<album | ParsedPrismaError> => {
  try {
    return await prisma.album.create({ data: { artist_id: artistID, title: title } });
  } catch (error) {
    const prismaError = new PrismaErrorLogger(error as PrismaClientErrors);
    return prismaError.parseErrors();
  }
};

export default createAlbum;
