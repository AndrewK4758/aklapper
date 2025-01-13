import { Request, Response } from 'express';
/**
 * Handles POST requests to create a new artist in the database.
 *
 * @param req - The Express request object containing the artist name in the request body.
 * @param resp - The Express response object used to send the response back to the client.
 * @returns No explicit return value. It sends a JSON response indicating success or failure, along with a success message or an error message.
 */
declare const postArtists: (req: Request, resp: Response) => Promise<void>;
export default postArtists;
//# sourceMappingURL=post-artists.d.ts.map