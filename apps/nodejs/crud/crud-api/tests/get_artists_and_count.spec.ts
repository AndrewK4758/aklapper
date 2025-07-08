import getArtistsAndCount from '../src/services/prisma/artist/get_artists_and_count.js';

describe('Test Prisma findArtist service', () => {
  it('Should pass and return list of Artists', async () => {
    const { count, data } = await getArtistsAndCount({ take: '25', skip: '0', cursor: '1' });
    expect(count).toBeGreaterThan(1);
    expect(data.length).toEqual(25);
  });
});
