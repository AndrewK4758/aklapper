import { Request, Response } from 'express';
/**
 * Retrieves a paginated list of albums from the database.
 *
 * This function checks if the `take` query parameter is present in the request. If it is, it extracts the `take`, `skip`, and `cursor` values from the query parameters and constructs a Prisma query to retrieve a paginated list of albums. The retrieved albums are then sent as a JSON response.
 *
 * @param req - The Express request object, which may contain query parameters for pagination.
 * @param resp - The Express response object, used to send the response back to the client.
 * @returns No explicit return value. It sends a JSON response with the paginated list of albums if the `take` parameter is present, otherwise it does nothing.
 */
declare const getAlbums: (req: Request, resp: Response) => Promise<void>;
export default getAlbums;
//# sourceMappingURL=get-all-albums.d.ts.map