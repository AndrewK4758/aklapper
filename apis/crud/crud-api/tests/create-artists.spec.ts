import type { artist } from '@prisma/client';
import type { PrismaClientKnownRequestError } from '@prisma/client/runtime/library.js';
import PrismaErrorLogger from '../../../../libs/prisma/src/lib/log-prisma-error.js';
import createArtists from '../src/services/prisma/artist/create-artists.js';
import deleteArtists from '../src/services/prisma/artist/delete-artist.js';
import findArtists from '../src/services/prisma/artist/find-artists.js';

let name: string;
describe('Test createArtists service', () => {
  beforeAll(async () => {
    name = 'CREATED ARTIST IN SERVICE';
    const artist = await findArtists({ where: { name: { equals: name } } });

    if (artist && artist.length) {
      await deleteArtists(artist[0].artist_id);
    }
  });
  it('Should pass and return the value of the created artist_id and name', async () => {
    const artist = (await createArtists(name)) as artist;
    expect(artist.name).toEqual(name);
    expect(artist.artist_id).toBeTruthy();
  });

  it('Should catch and return BuiltErrorMessage', async () => {
    try {
      await createArtists(name);
    } catch (err) {
      const prismaError = new PrismaErrorLogger(err as PrismaClientKnownRequestError);
      const parsedError = prismaError.displayError();
      console.log(parsedError);

      expect(prismaError).toBeInstanceOf(PrismaErrorLogger);
    }
  });
});
