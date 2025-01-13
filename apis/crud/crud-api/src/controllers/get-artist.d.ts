import { Request, Response } from 'express';
/**
 * Handles GET requests to retrieve an artist from the database by ID.
 *
 * @param req - The Express request object containing the artist ID in the URL parameters.
 * @param resp - The Express response object used to send the response back to the client.
 * @returns No explicit return value. It sends a JSON response with the artist data if found, or an error message if not found or an error occurs.
 */
declare const getArtist: (req: Request, resp: Response) => Promise<void>;
export default getArtist;
//# sourceMappingURL=get-artist.d.ts.map