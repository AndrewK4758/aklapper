import findArtists from '../src/services/prisma/artist/find-artists.js';

let artistId: number;
describe('Test Prisma findArtist service', () => {
  beforeAll(() => {
    artistId = Math.random() * 100;
  });
  it('Should pass and return list of Artists', async () => {
    const artistsList = await findArtists({ where: { artist_id: { gt: artistId } } });
    expect(artistsList.length).toBeGreaterThan(0);
  });
});
