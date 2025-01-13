import { Request, Response } from 'express';
/**
 * Handles GET requests to validate if an artist exists in the database.
 *
 * This function extracts the `name` query parameter from the request and constructs a Prisma query to check if an artist with the given name exists. It then sends a JSON response indicating whether the artist exists or not.
 *
 * @param req - The Express request object.
 * @param resp - The Express response object.
 * @returns No explicit return value. It sends a JSON response indicating artist existence.
 */
declare const validateArtists: (req: Request, resp: Response) => Promise<void>;
export default validateArtists;
//# sourceMappingURL=validate-artists.d.ts.map