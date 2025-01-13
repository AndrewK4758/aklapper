import { NextFunction, Request, Response } from 'express';
/**
 * Middleware function that retrieves a paginated list of artists from the database.
 *
 * This function checks if the `take` query parameter is present in the request. If it is, it extracts the `take`, `skip`, and `cursor` values from the query parameters and constructs a Prisma query to retrieve a paginated list of artists. The retrieved artists are then sent as a JSON response. If the `take` parameter is not present, it calls the `next()` middleware function to continue processing the request.
 *
 * @param req - The Express request object, which may contain query parameters for pagination.
 * @param resp - The Express response object, used to send the response back to the client.
 * @param next - The next middleware function in the chain.
 * @returns No explicit return value. It either sends a JSON response with the paginated list of artists or calls the `next()` middleware function.
 */
declare const getArtists: (req: Request, resp: Response, next: NextFunction) => Promise<void>;
export default getArtists;
//# sourceMappingURL=get-artists.d.ts.map