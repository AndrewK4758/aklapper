import { Prisma } from '@prisma/client';
import { DefaultArgs } from '@prisma/client/runtime/library';
/**
 * Creates a new track in the database.
 *
 * @param query - The Prisma query object for creating the track.
 * @returns A Promise that resolves to the newly created track, or null if an error occurs.
 */
declare const createTracks: (query: Prisma.trackCreateArgs<DefaultArgs>) => Promise<{
    name: string;
    album_id: number;
    media_type_id: number;
    genre_id: number | null;
    composer: string | null;
    milliseconds: number;
    bytes: number | null;
    unit_price: Prisma.Decimal;
    track_id: number;
} | null>;
export default createTracks;
//# sourceMappingURL=create-tracks.d.ts.map