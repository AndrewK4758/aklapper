import type { artist } from '@aklapper/chinook-client';
import createArtists from '../src/services/prisma/artist/create-artists.js';
import deleteArtists from '../src/services/prisma/artist/delete-artist.js';

let id: number, name: string;

describe('Test createArtists service', () => {
  beforeAll(async () => {
    name = 'ARTIST TO DELETE';
    id = ((await createArtists(name)) as artist).artist_id;
  });
  it('Should pass and return the value of the created artist_id and name', async () => {
    const artist = await deleteArtists(id);
    expect(artist).toBeTruthy();
    expect((artist as artist).name).toEqual(name);
  });
});
