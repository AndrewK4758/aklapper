import express, { Router } from 'express';
import getTracksCount from 'src/controllers/get_tracks_count.js';
import deleteArtistsAlbums from '../controllers/delete-artist-albums.js';
import deleteArtist from '../controllers/delete-artists.js';
import deleteTracks from '../controllers/delete-tracks.js';
import getAlbumsCount from '../controllers/get-albums-count.js';
import getAlbumsTracks from '../controllers/get-albums-tracks.js';
import getAlbums from '../controllers/get-all-albums.js';
import getArtistsAlbums from '../controllers/get-artist-albums.js';
import getArtistCount from '../controllers/get-artist-count.js';
import getArtists from '../controllers/get-artists.js';
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
    router.get('/artists', getArtistCount, getArtists, validateArtists);
    router.post('/artists', addArtists);
    router.patch('/artists', updateArtists);
    router.delete('/artists/:id', deleteArtist);

    router.get('/albums', getAlbumsCount, getArtistsAlbums, validateAlbums, getAlbums);
    router.post('/albums', createAlbumsOnArtists);
    router.patch('/albums', updateAlbums);
    router.delete('/albums/:id', deleteArtistsAlbums);

    router.get('/tracks', getTracksCount, getAlbumsTracks, validateTracks);
    router.post('/tracks', createTracksOnAlbum);
    router.patch('/tracks', updateTracks);
    router.delete('/tracks/:id', deleteTracks);

    router.post('/new-entry', createNewEntrys);

    router.get('/search', searchArtistsAndAlbums);
  }
}
