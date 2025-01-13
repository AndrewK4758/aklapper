import { album } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { DefaultArgs } from '@prisma/client/runtime/library';
/**
 * This function retrieves all albums from the database based on the provided query.
 *
 * @param query - An object containing the query parameters for filtering and sorting albums.
 * @returns A Promise that resolves to an array of album objects, or null if an error occurs.
 */
declare const findAllAlbums: (query: Prisma.albumFindManyArgs<DefaultArgs>) => Promise<album[] | null>;
export default findAllAlbums;
//# sourceMappingURL=find-albums.d.ts.map