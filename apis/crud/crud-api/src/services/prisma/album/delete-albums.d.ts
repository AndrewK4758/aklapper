/**
 * Deletes an album from the database by its ID.
 *
 * @param albumID - The ID of the album to delete.
 * @returns A Promise that resolves to the deleted album object, or null if an error occurs.
 */
declare const deleteArtistAlbums: (albumID: number) => Promise<{
    artist_id: number;
    title: string;
    album_id: number;
} | null>;
export default deleteArtistAlbums;
//# sourceMappingURL=delete-albums.d.ts.map