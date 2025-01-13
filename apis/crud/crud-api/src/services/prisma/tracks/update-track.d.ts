import { track, Prisma } from '@prisma/client';
/**
 * Updates an existing track in the database.
 *
 * @param trackData - The data for updating the track.
 * @returns A Promise that resolves to the updated track object, or null if an error occurs.
 */
declare const updateTrack: (trackData: track) => Promise<{
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
export default updateTrack;
//# sourceMappingURL=update-track.d.ts.map