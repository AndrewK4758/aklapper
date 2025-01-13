import { Prisma } from '@prisma/client';
import { DefaultArgs } from '@prisma/client/runtime/library';
/**
 * This function retrieves a list of albums for a specific artist from the database.
 *
 * @param query - An object containing the query parameters for filtering albums (e.g., artist ID).
 * @returns A Promise that resolves to an array of album objects for the specified artist, or null if an error occurs.
 */
declare const getArtistAlbums: (query: Prisma.albumFindManyArgs<DefaultArgs>) => import("@prisma/client/runtime/library").PrismaPromise<{
    artist_id: number;
    title: string;
    album_id: number;
}[]> | null;
export default getArtistAlbums;
//# sourceMappingURL=get-artist-albums.d.ts.map