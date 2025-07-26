import { prisma, Prisma, type artist } from '@aklapper/chinook-client';
import type { QueryOptions } from '@aklapper/types';
import type { DefaultArgs } from '@prisma/client/runtime/library';

export default async function kwgetArtistsAndCount({
  take,
  cursor,
}: QueryOptions): Promise<{ count: number; data: artist[] }> {
  try {
    const query = {
      take: parseInt(take, 10),
      skip: parseInt(cursor),
    } as Prisma.artistFindManyArgs<DefaultArgs>;

    const [count, data] = await prisma.$transaction([prisma.artist.count(), prisma.artist.findMany(query)]);

    return { count, data };
  } catch (error) {
    console.error(error);
    throw error;
  }
}
