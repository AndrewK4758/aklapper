import { Request, Response } from 'express';
/**
 * Handles PATCH requests to update a track in the database.
 *
 * @param req - The Express request object containing the track data in the request body.
 * @param resp - The Express response object used to send the response back to the client.
 * @returns No explicit return value. It sends a JSON response indicating success or failure, along with the updated track data or an error message.
 */
declare const updateTracks: (req: Request, resp: Response) => Promise<void>;
export default updateTracks;
//# sourceMappingURL=patch-update-tracks.d.ts.map