import { NextFunction, Request, Response } from 'express';
/**
 * Middleware function that retrieves the total count of albums in the database.
 *
 * This function checks if the `count` query parameter is present in the request. If it is, it retrieves the total number of albums from the database using Prisma and sends it as a JSON response. If the `count` parameter is not present, it calls the `next()` middleware function to continue processing the request.
 *
 * @param req - The Express request object.
 * @param resp - The Express response object.
 * @param next - The next middleware function in the chain.
 * @returns No explicit return value. It either sends a JSON response with the album count or calls the `next()` middleware function.
 */
declare const getAlbumsCount: (req: Request, resp: Response, next: NextFunction) => Promise<void>;
export default getAlbumsCount;
//# sourceMappingURL=get-albums-count.d.ts.map