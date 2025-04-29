import { PrismaErrorLogger, type ParsedPrismaError, type PrismaClientErrors } from '@aklapper/chinook-client';
import type { DefaultArgs } from '@prisma/client/runtime/library';
import { Prisma, type album } from 'node_modules/@aklapper/chinook-client/generated/client.js';
import prisma from '../client/prisma_client.js';
/**
 * This function retrieves all albums from the database based on the provided query.
 *
 * @param query - An object containing the query parameters for filtering and sorting albums.
 * @returns A Promise that resolves to an array of album objects, or null if an error occurs.
 */

const findAllAlbums = async (query: Prisma.albumFindManyArgs<DefaultArgs>): Promise<album[] | ParsedPrismaError> => {
  try {
    return await prisma.album.findMany(query);
  } catch (error) {
    const prismaError = new PrismaErrorLogger(error as PrismaClientErrors);
    return prismaError.parseErrors();
  }
};

export default findAllAlbums;
