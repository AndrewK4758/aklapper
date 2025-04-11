import { prisma, PrismaErrorLogger, type ParsedPrismaError, type PrismaClientErrors } from '@aklapper/chinook-client';
import type { DefaultArgs } from '@prisma/client/runtime/library';
import { artist, Prisma } from 'node_modules/@aklapper/chinook-client/generated/client.js';

/**
 * This function creates a new artist entry in the database, including associated albums and tracks.
 *
 * @param query - An object containing the data for the new artist entry, including nested album and track data.
 * @returns A Promise that resolves to the newly created artist object, or null if an error occurs.
 */

const createNewEntry = async (query: Prisma.artistCreateArgs<DefaultArgs>): Promise<artist | ParsedPrismaError> => {
  try {
    return prisma.artist.create(query);
  } catch (err) {
    const prismaError = new PrismaErrorLogger(err as PrismaClientErrors);
    return prismaError.parseErrors();
  }
};

export default createNewEntry;
