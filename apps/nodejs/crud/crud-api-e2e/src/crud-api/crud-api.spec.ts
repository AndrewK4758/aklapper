import axios from 'axios';
import { artist } from '@prisma/client';

let dataPost: { name: string }, artist_id: number, dataUpdate: artist;

describe('Test all endpoints for artist CRUD', () => {
  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    axios.defaults.baseURL = 'http://localhost:4000/api/v1';
    dataPost = { name: 'POSTED IN JEST' };
    dataUpdate = { artist_id: 1, name: 'UPDATED IN JEST' };
  });

  describe('GET /artists', () => {
    it('should return a list of artists', async () => {
      const TAKE = 25;
      const SKIP = 0;
      const CURSOR = 1;

      const resp = await axios.get(`/artists?take=${TAKE}&skip=${SKIP}&cursor=${CURSOR}`);
      const { allArtists } = resp.data;
      expect(allArtists.length).toEqual(TAKE);
    });
  });

  describe('POST /artists', () => {
    it('should return the value of the posted artist', async () => {
      const resp = await axios.post('/artists', dataPost);

      artist_id = Number(resp.data.newArtist.artist_id);

      expect(resp.data.newArtist.name).toEqual(dataPost.name);
    });
  });

  describe('UPDATE /artists', () => {
    it('Should return the value of the updatedArtist', async () => {
      const resp = await axios.patch('/artists', dataUpdate);

      expect(resp.data.updatedArtist.name).toEqual(dataUpdate.name);
    });
  });

  describe('DELETE /artists/:id', () => {
    it('Should return the value of deletedArtist', async () => {
      const resp = await axios.delete(`/artists/${artist_id}`);

      expect(resp.data.deletedArtist).toEqual({ ...dataPost, artist_id: artist_id });
    });
  });
});
