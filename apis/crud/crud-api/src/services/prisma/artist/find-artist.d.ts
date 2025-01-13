import { artist } from '@prisma/client';
/**
 * Finds an artist in the database by their ID.
 *
 * @param id - The ID of the artist to find.
 * @returns A Promise that resolves to the artist object if found, otherwise null.
 */
declare const findArtist: (id: number) => Promise<artist | null>;
export default findArtist;
//# sourceMappingURL=find-artist.d.ts.map