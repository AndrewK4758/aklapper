import { NextFunction, Request, Response } from 'express';
/**
 * Middleware function that retrieves tracks for an album and their count.
 *
 * This function checks if the `name` query parameter is present. If it is, it passes control to the next middleware function. Otherwise, it retrieves the `albumID` from the query parameters, fetches the tracks associated with that album from the database using Prisma, counts the tracks, and sends the tracks and their count as a JSON response.
 *
 * @param req - The Express request object.
 * @param resp - The Express response object.
 * @param next - The next middleware function in the chain.
 * @returns No explicit return value. It either sends a JSON response with the tracks and their count or calls the `next()` middleware function.
 */
declare const getAlbumsTracks: (req: Request, resp: Response, next: NextFunction) => Promise<void>;
export default getAlbumsTracks;
//# sourceMappingURL=get-albums-tracks.d.ts.map