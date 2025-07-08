import { Prisma, type album } from '@aklapper/chinook-client';
import type { CRUD_ApiResponse } from '@aklapper/types';
import type { DefaultArgs } from '@prisma/client/runtime/library';
import type { Request, Response } from 'express';
import findAllAlbumsAndCount from '../../services/prisma/album/find-albums.js';

/**
 * Retrieves a paginated list of albums from the database.
 *
 * This function checks if the `take` query parameter is present in the request. If it is, it extracts the `take`, `skip`, and `cursor` values from the query parameters and constructs a Prisma query to retrieve a paginated list of albums. The retrieved albums are then sent as a JSON response.
 *
 * @param req - The Express request object, which may contain query parameters for pagination.
 * @param resp - The Express response object, used to send the response back to the client.
 * @returns No explicit return value. It sends a JSON response with the paginated list of albums if the `take` parameter is present, otherwise it does nothing.
 */

const getAlbums = async (req: Request, resp: Response) => {
  try {
    const { take, skip, cursor } = req.query;

    const query = {
      take: parseInt(take as string, 10),
      skip: parseInt(skip as string, 10),
      cursor: { album_id: parseInt(cursor as string, 10) },
    } as Prisma.albumFindManyArgs<DefaultArgs>;

    const { count, data } = await findAllAlbumsAndCount(query);

    const values: CRUD_ApiResponse<{ count: number; data: album[] }> = {
      message: 'All Albums Loaded',
      data: {
        count: count,
        data: data,
      },
    };
    resp.status(200).json(values);
  } catch (error) {
    console.error(error);
    resp.status(500).json(error);
  }
};

export default getAlbums;
