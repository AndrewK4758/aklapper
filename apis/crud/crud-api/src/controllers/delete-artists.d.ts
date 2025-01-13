import { Request, Response } from 'express';
/**
 * Handles DELETE requests to delete an artist from the database.
 *
 * @param req - The Express request object containing the artist ID in the URL parameters.
 * @param resp - The Express response object used to send the response back to the client.
 * @returns No explicit return value. It sends a JSON response indicating success or failure, along with the deleted artist data or an error message.
 */
declare const deleteArtist: (req: Request, resp: Response) => Promise<void>;
export default deleteArtist;
//# sourceMappingURL=delete-artists.d.ts.map