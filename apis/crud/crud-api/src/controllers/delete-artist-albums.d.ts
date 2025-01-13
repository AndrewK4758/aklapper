import { Request, Response } from 'express';
/**
 * This function handles DELETE requests to delete an album associated with a specific artist.
 *
 * @param req - The Express request object, which should contain the artist ID and album ID in the URL parameters.
 * @param res - The Express response object, used to send the response back to the client.
 * @returns No explicit return value. It sends a JSON response indicating success or failure, along with the deleted album data or an error message.
 */
declare const deleteArtistsAlbums: (req: Request, resp: Response) => Promise<void>;
export default deleteArtistsAlbums;
//# sourceMappingURL=delete-artist-albums.d.ts.map