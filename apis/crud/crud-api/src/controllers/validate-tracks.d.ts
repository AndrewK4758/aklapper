import { Request, Response } from 'express';
/**
 * Handles GET requests to validate if a track exists within a specific album in the database.
 *
 * This function extracts the `albumID` and `name` query parameters from the request. It constructs a Prisma query to check if a track with the given name exists within the specified album. It then sends a JSON response indicating whether the track exists or not.
 *
 * @param req - The Express request object.
 * @param resp - The Express response object.
 * @returns No explicit return value. It sends a JSON response indicating track existence within the album.
 */
declare const validateTracks: (req: Request, resp: Response) => Promise<void>;
export default validateTracks;
//# sourceMappingURL=validate-tracks.d.ts.map