import { type artist } from '@prisma/client';
import { PrismaErrorLogger } from '@aklapper/prisma';
import createArtists from '../src/services/prisma/artist/create-artists.js';

let name: string;
describe('Test createArtists service', () => {
  beforeAll(() => {
    name = 'CREATED ARTIST IN SERVICE';
  });
  it('Should pass and return the value of the created artist_id and name', async () => {
    try {
      const artist = (await createArtists(name)) as artist;
      console.log(artist);
      expect(artist.name).toEqual(name);
      expect(artist.artist_id).toBeTruthy();
    } catch (error) {
      console.error(error);
    }
  });

  it('Should catch and return PrismaErrorLogger Message', async () => {
    try {
      await createArtists(name);
    } catch (error) {
      expect(error).toBeInstanceOf(PrismaErrorLogger);
    }
  });
});
