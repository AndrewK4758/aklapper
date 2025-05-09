import type { artist } from '@aklapper/chinook-client';
import createArtists from '../src/services/prisma/artist/create-artists.js';
import deleteArtists from '../src/services/prisma/artist/delete-artist.js';
import updateArtist from '../src/services/prisma/artist/update-artists.js';

let id: number, name: string, newName: string;
describe('Test updateArtist service', () => {
  beforeAll(async () => {
    name = 'ARTIST TO UPDATE';
    id = ((await createArtists(name)) as artist).artist_id;
  });
  afterAll(async () => {
    await deleteArtists(id);
  });
  it('ShoulAd return the updated name for the provided artist_id', async () => {
    newName = 'UPDATED IN JEST';
    const updatedArtist = await updateArtist(id, newName);
    if (updatedArtist) id = updatedArtist.artist_id;
    expect(updatedArtist).toBeTruthy();
    expect((updatedArtist as artist).name).toEqual(newName);
  });
});
