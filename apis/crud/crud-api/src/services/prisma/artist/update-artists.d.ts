import { artist } from '@prisma/client';
/**
 * Updates an existing artist in the database.
 *
 * @param artist_id - The ID of the artist to update.
 * @param name - The new name of the artist.
 * @returns A Promise that resolves to the updated artist object, or null if an error occurs.
 */
declare const updateArtist: (artist_id: number, name: string) => Promise<artist | null>;
export default updateArtist;
//# sourceMappingURL=update-artists.d.ts.map