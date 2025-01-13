import { Request, Response } from 'express';
/**
 * This function handles POST requests to add a new album to an existing artist.
 *
 * @param req - The Express request object, which should contain the artist ID in the URL parameters and the album title in the request body.
 * @param res - The Express response object, used to send the response back to the client.
 * @returns No explicit return value. It sends a JSON response indicating success or failure, along with the new album data or an error message.
 */
declare const createAlbumsOnArtists: (req: Request, resp: Response) => Promise<void>;
export default createAlbumsOnArtists;
//# sourceMappingURL=post-albums-on-artist.d.ts.map