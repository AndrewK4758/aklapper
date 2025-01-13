import type { Prisma } from '@prisma/client';
/**
 * Checks if a track exists in the database.
 *
 * @param query - The Prisma query object to filter tracks.
 * @returns A Promise that resolves to true if a track matching the query exists, false otherwise, or null if an error occurs.
 */
declare const validateTrack: (query: Prisma.trackWhereInput) => Promise<boolean | null>;
export default validateTrack;
//# sourceMappingURL=validate-track.d.ts.map