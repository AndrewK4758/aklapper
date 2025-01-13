import { Prisma } from '@prisma/client';
import { DefaultArgs } from '@prisma/client/runtime/library';
/**
 * This function creates a new artist entry in the database, including associated albums and tracks.
 *
 * @param query - An object containing the data for the new artist entry, including nested album and track data.
 * @returns A Promise that resolves to the newly created artist object, or null if an error occurs.
 */
declare const createNewEntry: (query: Prisma.artistCreateArgs<DefaultArgs>) => Promise<{
    name: string;
    artist_id: number;
} | null>;
export default createNewEntry;
//# sourceMappingURL=create-new-entry.d.ts.map