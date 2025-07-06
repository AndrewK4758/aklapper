import { prisma, Prisma, type artist } from '@aklapper/chinook-client';
import type { DefaultArgs } from '@prisma/client/runtime/library';

export type ArtistPagination = {
  take: string;
  skip: string;
  cursor: string;
};

export default async function getArtistsAndCount({
  take,
  skip,
  cursor,
}: ArtistPagination): Promise<{ count: number; data: artist[] }> {
  try {
    const query = {
      take: parseInt(take as string, 10),
      skip: parseInt(skip as string, 10),
      cursor: { artist_id: parseInt(cursor as string, 10) },
    } as Prisma.artistFindManyArgs<DefaultArgs>;

    const [count, data] = await prisma.$transaction([prisma.artist.count(), prisma.artist.findMany(query)]);

    return { count, data };
  } catch (error) {
    console.error(error);
    throw error;
  }
}
