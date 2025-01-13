/**
 * Creates a new album in the database.
 *
 * @param artistID - The ID of the artist to associate the album with.
 * @param title - The title of the album.
 * @returns A Promise that resolves to the newly created album object, or null if an error occurs.
 */
declare const createAlbum: (artistID: number, title: string) => Promise<{
    artist_id: number;
    title: string;
    album_id: number;
} | null>;
export default createAlbum;
//# sourceMappingURL=create-albums.d.ts.map