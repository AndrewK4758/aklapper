import { Request, Response } from 'express';
/**
 * Handles DELETE requests to delete a track from the database.
 *
 * @param req - The Express request object containing the track ID in the URL parameters.
 * @param resp - The Express response object used to send the response back to the client.
 * @returns No explicit return value. It sends a JSON response indicating success or failure, along with the deleted track data or an error message.
 */
declare const deleteTracks: (req: Request, resp: Response) => Promise<void>;
export default deleteTracks;
//# sourceMappingURL=delete-tracks.d.ts.map