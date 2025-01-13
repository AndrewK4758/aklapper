import { NextFunction, Request, Response } from 'express';
/**
 * Middleware function that retrieves albums for a specific artist.
 *
 * This function checks if the `title` query parameter is NOT present and the `artistID` query parameter IS present. If these conditions are met, it retrieves the `artistID` from the query parameters, fetches the albums associated with that artist from the database using Prisma, and sends the albums as a JSON response. If the conditions are not met, it calls the `next()` middleware function to continue processing the request.
 *
 * @param req - The Express request object.
 * @param resp - The Express response object.
 * @param next - The next middleware function in the chain.
 * @returns No explicit return value. It either sends a JSON response with the artist's albums or calls the `next()` middleware function.
 */
declare const getArtistsAlbums: (req: Request, resp: Response, next: NextFunction) => Promise<void>;
export default getArtistsAlbums;
//# sourceMappingURL=get-artist-albums.d.ts.map