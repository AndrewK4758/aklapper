import type { artist } from 'node_modules/@aklapper/chinook-client/generated/client.js';
import findArtists from '../src/services/prisma/artist/find-artists.js';

describe('Test Prisma findArtist service', () => {
  it('Should pass and return list of Artists', async () => {
    const artistsList = await findArtists({});
    expect((artistsList as artist[]).length).toBeGreaterThan(0);
  });
});
