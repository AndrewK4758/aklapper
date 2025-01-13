import { Request, Response } from 'express';
/**
 * Handles POST requests to create a new track and associate it with an album.
 *
 * @param req - The Express request object containing the track name and album ID in the request body.
 * @param resp - The Express response object used to send the response back to the client.
 * @returns No explicit return value. It sends a JSON response indicating success or failure, along with the new track data or an error message.
 */
declare const createTracksOnAlbum: (req: Request, resp: Response) => Promise<void>;
export default createTracksOnAlbum;
//# sourceMappingURL=post-tracks-on-album.d.ts.map