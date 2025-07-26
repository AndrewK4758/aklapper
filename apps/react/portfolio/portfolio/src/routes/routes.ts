import { lazy } from 'react';
import type { RouteObject } from 'react-router';
import Layout from '../components/layout/layout.js';
import GameLoading from '../components/loading/loading.js';
import PrivacyPolicy from '../components/privacy-policy/privacy-policy.js';
import BaseError from '../errors/base_error.js';
import Crud from '../pages/crud/crud.js';
import Games from '../pages/games/games.js';
import GenAiHome from '../pages/gen-ai/gen-ai.js';
import Home from '../pages/home/home.js';
import LandingPage from '../pages/landing/landing.js';
import handleArtistAlbumsActions from '../services/actions/crud-actions/handle_album_on_artist_actions.js';
import handleArtistActions from '../services/actions/crud-actions/handle_artist_actions.js';
import handleTrackActions from '../services/actions/crud-actions/handle_track_actions.js';
import generateImageAction from '../services/actions/generate-image-action.js';
import loadAlbumTracks from '../services/loaders/crud-loaders/load-album-tracks.js';
import loadAlbums from '../services/loaders/crud-loaders/load-albums.js';
import loadArtistsAndCount from '../services/loaders/crud-loaders/load-artists_and_count.js';
import loadAlbumsForArtist from '../services/loaders/crud-loaders/load_albums_for_artist.js';
import registerPlayersAndStartGame from '../services/loaders/register-players-and-start-game.js';
const ActiveGameSession = lazy(() => import('../components/games/active_game_session.js'));
const AddEntry = lazy(() => import('../components/crud/add-entry/add-entry.js'));
const Album = lazy(() => import('../components/crud/albums/album-base.js'));
const Artist = lazy(() => import('../components/crud/artists/artist-base.js'));
const AlbumsOnArtist = lazy(() => import('../components/crud/albums/artist-albums.js'));
const Tracks = lazy(() => import('../components/crud/tracks/album-tracks.js'));
const TextGenerator = lazy(() => import('../components/gen-ai/text/text.js'));
const Image = lazy(() => import('../components/gen-ai/image/image.js'));
const Audio = lazy(() => import('../components/gen-ai/audio/audio.js'));

/**
 * React Router DOM Route Object array.
 *
 * This array defines the routes for the application, mapping URLs to
 * specific Components and their associated actions and loaders. It structus
 * the application into main sections like "games", "crud", and "gen-ai",
 * each with nested routes for specific functionalities.
 *
 * @type {RouteObject[]}
 */

const routes: RouteObject[] = [
  {
    id: 'landing',
    path: '/',
    Component: LandingPage,
    ErrorBoundary: BaseError,
  },
  {
    path: 'portfolio',
    Component: Layout,
    children: [
      {
        index: true,
        Component: Home,
      },
      {
        path: 'crud',
        Component: Crud,
        children: [
          {
            id: 'artists',
            path: 'artists',
            Component: Artist,
            loader: loadArtistsAndCount,
            action: handleArtistActions,
            children: [
              {
                id: 'artist_albums',
                path: ':artistID/albums',
                Component: AlbumsOnArtist,
                loader: loadAlbumsForArtist,
                action: handleArtistAlbumsActions,
                children: [
                  {
                    path: ':albumID/tracks',
                    Component: Tracks,
                    loader: loadAlbumTracks,
                    action: handleTrackActions,
                  },
                ],
              },
            ],
          },
          {
            path: 'albums',
            Component: Album,
            loader: loadAlbums,
            children: [
              {
                path: ':albumID/tracks',
                Component: Tracks,
                loader: loadAlbumTracks,
              },
            ],
          },
          {
            path: 'add-entry',
            Component: AddEntry,
          },
        ],
      },
      {
        id: 'games',
        path: 'games',
        Component: Games,
        children: [
          {
            id: 'active-game',
            path: ':id',
            Component: ActiveGameSession,
            loader: registerPlayersAndStartGame,
            HydrateFallback: GameLoading,
          },
        ],
      },
      {
        id: 'gen-ai',
        path: 'gen-ai',
        Component: GenAiHome,
        ErrorBoundary: BaseError,
        children: [
          {
            id: 'text',
            path: 'text',
            Component: TextGenerator,
            ErrorBoundary: BaseError,
          },
          {
            id: 'image',
            path: 'image',
            Component: Image,
            action: generateImageAction,
            ErrorBoundary: BaseError,
          },
          {
            id: 'audio',
            path: 'audio',
            Component: Audio,
            ErrorBoundary: BaseError,
          },
        ],
      },
      {
        id: 'privacy-policy',
        path: 'privacy-policy',
        Component: PrivacyPolicy,
      },
    ],
  },
];

export default routes;
