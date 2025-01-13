import { artist } from '@prisma/client';
/**
 * This function creates a new artist in the database.
 *
 * @param name - The name of the artist to be created.
 * @returns A Promise that resolves to the newly created artist object, or null if an error occurs.
 */
declare const createArtists: (name: string) => Promise<artist | null>;
export default createArtists;
//# sourceMappingURL=create-artists.d.ts.map