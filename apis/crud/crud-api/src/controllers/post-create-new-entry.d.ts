import { Request, Response } from 'express';
/**
 * Handles POST requests to create a new entry in the database, including an artist, album, and track.
 *
 * @param req - The Express request object containing the artist, album, and track data in the request body.
 * @param resp - The Express response object used to send the response back to the client.
 * @returns No explicit return value. It sends a JSON response indicating success or failure, along with the new entry data or an error message.
 */
declare const createNewEntrys: (req: Request, resp: Response) => Promise<void>;
export default createNewEntrys;
//# sourceMappingURL=post-create-new-entry.d.ts.map