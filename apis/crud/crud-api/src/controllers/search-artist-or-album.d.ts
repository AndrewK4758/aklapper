import { Request, Response } from 'express';
/**
 * Handles GET requests to search for artists or albums in the database.
 *
 * This function extracts the `search` and `type` query parameters from the request. The `search` parameter specifies the search term, and the `type` parameter indicates whether to search for artists or albums. It constructs Prisma queries based on the `type` and uses the `searchArtist` or `searchAlbum` service functions to retrieve the matching results. The results are then sent as a JSON response.
 *
 * @param req - The Express request object containing the search term and type in the query parameters.
 * @param resp - The Express response object used to send the response back to the client.
 * @returns No explicit return value. It sends a JSON response with the search results or an error message if an error occurs.
 */
declare const searchArtistsAndAlbums: (req: Request, resp: Response) => Promise<void>;
export default searchArtistsAndAlbums;
//# sourceMappingURL=search-artist-or-album.d.ts.map