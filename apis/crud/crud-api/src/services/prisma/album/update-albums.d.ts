/**
 * Updates an existing album in the database.
 *
 * @param albumID - The ID of the album to update.
 * @param title - The new title of the album.
 * @returns A Promise that resolves to the updated album object, or null if an error occurs.
 */
declare const updateAlbum: (albumID: number, title: string) => Promise<{
    artist_id: number;
    title: string;
    album_id: number;
} | null>;
export default updateAlbum;
//# sourceMappingURL=update-albums.d.ts.map