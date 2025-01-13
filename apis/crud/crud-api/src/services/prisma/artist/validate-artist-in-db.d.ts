import type { Prisma } from '@prisma/client';
/**
 * This function checks if an artist exists in the database based on the provided query.
 *
 * @param query - An object containing the query parameters for filtering artists.
 * @returns A Promise that resolves to true if an artist matching the query exists, false otherwise, or null if an error occurs.
 */
declare const validateArtist: (query: Prisma.artistWhereInput) => Promise<boolean | null>;
export default validateArtist;
//# sourceMappingURL=validate-artist-in-db.d.ts.map