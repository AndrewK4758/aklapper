import { artist } from '@prisma/client';
/**
 * This function deletes an artist from the database by their ID.
 *
 * @param id - The ID of the artist to delete.
 * @returns A Promise that resolves to the deleted artist object, or null if an error occurs.
 */
declare const deleteArtists: (id: number) => Promise<artist | null>;
export default deleteArtists;
//# sourceMappingURL=delete-artist.d.ts.map