import type { Prisma } from '@prisma/client';
/**
 * Checks if an album exists in the database.
 *
 * @param query - The Prisma query object to filter albums.
 * @returns A Promise that resolves to true if the album exists, false otherwise, or null if an error occurs.
 */
declare const validateAlbum: (query: Prisma.albumWhereInput) => Promise<boolean | null>;
export default validateAlbum;
//# sourceMappingURL=validate-album.d.ts.map