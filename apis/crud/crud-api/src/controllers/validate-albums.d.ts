import { NextFunction, Request, Response } from 'express';
/**
 * Middleware function that validates if an album exists in the database.
 *
 * This function checks if the `title` query parameter is present in the request. If it is, it extracts the `artistID` and `title` from the query parameters and constructs a Prisma query to check if an album with the given title and artist ID exists. It then sends a JSON response indicating whether the album exists or not. If the `title` parameter is not present, it calls the `next()` middleware function to continue processing the request.
 *
 * @param req - The Express request object.
 * @param resp - The Express response object.
 * @param next - The next middleware function in the chain.
 * @returns No explicit return value. It either sends a JSON response indicating album existence or calls the `next()` middleware function.
 */
declare const validateAlbums: (req: Request, resp: Response, next: NextFunction) => Promise<void>;
export default validateAlbums;
//# sourceMappingURL=validate-albums.d.ts.map