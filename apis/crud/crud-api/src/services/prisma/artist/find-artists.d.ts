import { artist } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { DefaultArgs } from '@prisma/client/runtime/library';
/**
 * This function retrieves a list of artists from the database based on the provided query.
 *
 * @param query - An object containing the query parameters for filtering and sorting artists.
 * @returns A Promise that resolves to an array of artist objects, or null if an error occurs.
 */
declare const findArtists: (query: Prisma.artistFindManyArgs<DefaultArgs>) => Promise<artist[] | null>;
export default findArtists;
//# sourceMappingURL=find-artists.d.ts.map