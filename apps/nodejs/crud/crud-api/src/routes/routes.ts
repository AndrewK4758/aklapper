import express, { Router } from 'express';
import deleteArtistsAlbums from '../controllers/delete/delete-artist-albums.js';
import deleteArtist from '../controllers/delete/delete-artists.js';
import deleteTracks from '../controllers/delete/delete-tracks.js';
import getAlbumsTracks from '../controllers/get/get-albums-tracks.js';
import getAlbums from '../controllers/get/get-albums_and_count.js';
import getArtistsAlbums from '../controllers/get/get-artist-albums.js';
import artistsAndCount from '../controllers/get/get_artists_and_count.js';
import searchArtistsAndAlbums from '../controllers/get/search-artist-or-album.js';
import updateAlbums from '../controllers/patch/patch-update-albums.js';
import updateArtists from '../controllers/patch/patch-update-artists.js';
import updateTracks from '../controllers/patch/patch-update-tracks.js';
import createAlbumsOnArtists from '../controllers/post/post-albums-on-artist.js';
import addArtists from '../controllers/post/post-artists.js';
import createNewEntrys from '../controllers/post/post-create-new-entry.js';
import createTracksOnAlbum from '../controllers/post/post-tracks-on-album.js';
import validateAlbums from '../controllers/validate/validate-albums.js';
import validateArtists from '../controllers/validate/validate-artists.js';
import validateTracks from '../controllers/validate/validate-tracks.js';

export const router: Router = Router();

export default class Routes {
  constructor() {
    router.use(express.json());

    router.get('/', (_, resp) => {
      resp.status(201).send('HEALTHY');
    });

    router.get('/artists', artistsAndCount);
    router.post('/artists', addArtists);
    router.patch('/artists', updateArtists);
    router.delete('/artists/:id', deleteArtist);
    router.get('/artist/:id', getArtistsAlbums);

    router.get('/validate/:category', validateArtists, validateAlbums, validateTracks);

    router.get('/albums', getAlbums);
    router.post('/albums', createAlbumsOnArtists);
    router.patch('/albums', updateAlbums);
    router.delete('/albums/:id', deleteArtistsAlbums);

    router.get('/tracks', getAlbumsTracks);
    router.post('/tracks', createTracksOnAlbum);
    router.patch('/tracks', updateTracks);
    router.delete('/tracks/:id', deleteTracks);

    router.post('/new-entry', createNewEntrys);

    router.get('/search', searchArtistsAndAlbums);
  }
}
