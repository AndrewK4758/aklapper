import { Prisma } from '@prisma/client';
import { DefaultArgs } from '@prisma/client/runtime/library';
/**
 * Searches for albums in the database based on the provided query.
 *
 * @param query - An object containing the Prisma query parameters for filtering and sorting albums. This allows you to specify criteria such as title, artist ID, etc.
 * @returns A Promise that resolves to an array of `album` objects if the search is successful, `null` if an error occurs.
 */
declare const searchAlbum: (query: Prisma.albumFindManyArgs<DefaultArgs>) => Promise<{
    artist_id: number;
    title: string;
    album_id: number;
}[] | null>;
export default searchAlbum;
//# sourceMappingURL=search-album.d.ts.map