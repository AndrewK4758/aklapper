import express, { Router } from 'express';
import deleteArtistsAlbums from '../controllers/delete-artist-albums.js';
import deleteArtist from '../controllers/delete-artists.js';
import deleteTracks from '../controllers/delete-tracks.js';
import getAlbumsTracks from '../controllers/get-albums-tracks.js';
import getAlbums from '../controllers/get-all-albums.js';
import getArtistsAlbums from '../controllers/get-artist-albums.js';
import artistsAndCount from '../controllers/get_artists_and_count.js';
import updateAlbums from '../controllers/patch-update-albums.js';
import updateTracks from '../controllers/patch-update-tracks.js';
import createAlbumsOnArtists from '../controllers/post-albums-on-artist.js';
import addArtists from '../controllers/post-artists.js';
import createNewEntrys from '../controllers/post-create-new-entry.js';
import createTracksOnAlbum from '../controllers/post-tracks-on-album.js';
import searchArtistsAndAlbums from '../controllers/search-artist-or-album.js';
import updateArtists from '../controllers/update-artists.js';
import validateAlbums from '../controllers/validate-albums.js';
import validateArtists from '../controllers/validate-artists.js';
import validateTracks from '../controllers/validate-tracks.js';

export const router: Router = Router();

export default class Routes {
  constructor() {
    router.use(express.json());

    router.get('/', (_, resp) => {
      resp.sendStatus(201);
    });
    router.get('/artists', artistsAndCount, validateArtists);
    router.post('/artists', addArtists);
    router.patch('/artists', updateArtists);
    router.delete('/artists/:id', deleteArtist);

    router.get('/artist/:id', getArtistsAlbums);

    router.get('/artist/:id', getArtistsAlbums);

    router.get('/albums', getAlbums, getArtistsAlbums, validateAlbums);
    router.post('/albums', createAlbumsOnArtists);
    router.patch('/albums', updateAlbums);
    router.delete('/albums/:id', deleteArtistsAlbums);

    router.get('/tracks', getAlbumsTracks, validateTracks);
    router.post('/tracks', createTracksOnAlbum);
    router.patch('/tracks', updateTracks);
    router.delete('/tracks/:id', deleteTracks);

    router.post('/new-entry', createNewEntrys);

    router.get('/search', searchArtistsAndAlbums);
  }
}
