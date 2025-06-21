import { PrismaErrorLogger, type ParsedPrismaError, type PrismaClientErrors } from '@aklapper/chinook-client';
import type { DefaultArgs } from '@prisma/client/runtime/library';
import { Prisma, type album } from 'node_modules/@aklapper/chinook-client/generated/client.js';
import prisma from '../client/prisma_client.js';
/**
 * This function retrieves a list of albums for a specific artist from the database.
 *
 * @param query - An object containing the query parameters for filtering albums (e.g., artist ID).
 * @returns A Promise that resolves to an array of album objects for the specified artist, or null if an error occurs.
 */

const getArtistAlbums = async (query: Prisma.albumFindManyArgs<DefaultArgs>): Promise<album[]> => {
  try {
    return await prisma.album.findMany(query);
  } catch (error) {
    const prismaError = new PrismaErrorLogger(error as PrismaClientErrors);
    throw prismaError.parseErrors();
  }
};

export default getArtistAlbums;
