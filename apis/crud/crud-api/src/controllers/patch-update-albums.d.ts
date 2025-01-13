import { Request, Response } from 'express';
/**
 * This function handles PATCH requests to update the title of an existing album.
 *
 * @param req - The Express request object, which should contain the album ID in the URL parameters and the new album title in the request body.
 * @param res - The Express response object, used to send the response back to the client.
 * @returns No explicit return value. It sends a JSON response indicating success or failure, along with the updated album data or an error message.
 */
declare const updateAlbums: (req: Request, resp: Response) => Promise<void>;
export default updateAlbums;
//# sourceMappingURL=patch-update-albums.d.ts.map