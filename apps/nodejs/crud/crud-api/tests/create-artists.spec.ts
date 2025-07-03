// import { PrismaErrorLogger } from '@aklapper/chinook-client';
import createArtists from '../src/services/prisma/artist/create-artists.js';

let name: string;
describe('Test createArtists service', () => {
  beforeAll(() => {
    name = 'CREATED ARTIST IN SERVICE 20000';
  });
  it('Should pass and return the value of the created artist_id and name', async () => {
    const artist = await createArtists(name);
    expect(artist.name).toEqual(name);
    expect(artist.artist_id).toBeTruthy();
  });

  // it('Should catch and return PrismaErrorLogger Message', async () => {
  //   try {
  //     await createArtists(name);
  //   } catch (error) {
  //     expect(error).toBeInstanceOf(PrismaErrorLogger);
  //   }
  // });
});
