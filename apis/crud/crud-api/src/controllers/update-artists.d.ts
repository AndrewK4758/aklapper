import { Request, Response } from 'express';
/**
 * Handles PATCH requests to update an artist in the database.
 *
 * @param req - The Express request object containing the artist ID and new name in the request body.
 * @param resp - The Express response object used to send the response back to the client.
 * @returns No explicit return value. It sends a JSON response indicating success or failure, along with the updated artist data or an error message.
 */
declare const updateArtists: (req: Request, resp: Response) => Promise<void>;
export default updateArtists;
//# sourceMappingURL=update-artists.d.ts.map