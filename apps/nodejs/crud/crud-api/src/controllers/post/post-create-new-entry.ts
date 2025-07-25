import { type album, type artist, Prisma, type track } from '@aklapper/chinook-client';
import type { DefaultArgs } from '@prisma/client/runtime/library';
import type { Request, Response } from 'express';
import createNewEntry from '../../services/prisma/create-new-entry.js';

interface NewEntryData {
  artist: artist;
  album: album;
  track: track;
}

/**
 * Handles POST requests to create a new entry in the database, including an artist, album, and track.
 *
 * @param req - The Express request object containing the artist, album, and track data in the request body.
 * @param resp - The Express response object used to send the response back to the client.
 * @returns No explicit return value. It sends a JSON response indicating success or failure, along with the new entry data or an error message.
 */

const createNewEntrys = async (req: Request, resp: Response) => {
  try {
    const { artist, album, track } = req.body as NewEntryData;

    const query = {
      include: { album: { include: { track: true } } },
      data: {
        name: artist.name,
        album: {
          create: [
            {
              title: album.title,
              track: {
                create: {
                  name: track.name,
                  media_type_id: track.media_type_id,
                  genre_id: track.genre_id,
                  composer: track.composer,
                  milliseconds: track.milliseconds,
                  bytes: track.bytes,
                  unit_price: track.unit_price,
                },
              },
            },
          ],
        },
      },
    } as Prisma.artistCreateArgs<DefaultArgs>;

    const newEntry = await createNewEntry(query);

    resp.status(200).json({ newEntry: newEntry });
  } catch (error) {
    console.error(error);
    resp.status(500).json(error);
  }
};
export default createNewEntrys;
