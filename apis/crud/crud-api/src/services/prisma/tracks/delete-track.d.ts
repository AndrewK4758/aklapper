import { Prisma } from '@prisma/client';
import { DefaultArgs } from '@prisma/client/runtime/library';
/**
 * Deletes a track from the database.
 *
 * @param query - The Prisma query for deleting the track.
 * @returns A Promise that resolves to the deleted track, or null if an error occurs.
 */
declare const deleteTrack: (query: Prisma.trackDeleteArgs<DefaultArgs>) => Promise<{
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
export default deleteTrack;
//# sourceMappingURL=delete-track.d.ts.map