import { Waiting } from '@aklapper/react-shared';
import { lazy } from 'react';
import type { RouteObject } from 'react-router';
import waiting from '../assets/images/swirly-dots-to-chrome.webp';

import PrivacyPolicy from '../components/privacy-policy/privacy-policy';

import BaseError from '../errors/base_error';
import Home from '../pages/home/home';
import LandingPage from '../pages/landing/landing';

import loadAlbumTracks from '../services/loaders/crud-loaders/load-album-tracks';
import loadAlbums from '../services/loaders/crud-loaders/load-albums';
import loadArtistsAndCount from '../services/loaders/crud-loaders/load-artists';
import loadAlbumsForArtist from '../services/loaders/crud-loaders/load_albums_for_artist';

import Layout from '../components/layout/layout';
import Crud from '../pages/crud/crud';
import Games from '../pages/games/games';
import GenAiHome from '../pages/gen-ai/gen-ai';

import handleArtistAlbumsActions from '../services/actions/crud-actions/handle_album_on_artist_actions';
import handleArtistActions from '../services/actions/crud-actions/handle_artist_actions';
import handleTrackActions from '../services/actions/crud-actions/handle_track_actions';
import generateImageAction from '../services/actions/generate-image-action';

import GameLoading from '../components/loading/loading';
import registerPlayersAndStartGame from '../services/loaders/register-players-and-start-game';

const ActiveGameSession = lazy(() => import('../components/games/active_game_session'));

const AddEntry = lazy(() => import('../components/crud/add-entry/add-entry'));
const Album = lazy(() => import('../components/crud/albums/album-base'));
const Artist = lazy(() => import('../components/crud/artists/artist-base'));
const AlbumsOnArtist = lazy(() => import('../components/crud/albums/artist-albums'));
const Tracks = lazy(() => import('../components/crud/tracks/album-tracks'));

const TextGenerator = lazy(() => import('../components/gen-ai/text/text'));
const Image = lazy(() => import('../components/gen-ai/image/image'));
const Audio = lazy(() => import('../components/gen-ai/audio/audio'));

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
    path: '/',
    Component: LandingPage,
    hydrateFallbackElement: <Waiting src={waiting} />,
    errorElement: <BaseError />,
    id: 'landing',
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
        hydrateFallbackElement: <Waiting src={waiting} />,
        children: [
          {
            path: 'artists',
            Component: Artist,
            loader: loadArtistsAndCount,
            id: 'artists',
            action: handleArtistActions,
            children: [
              {
                path: ':artistID/albums',
                Component: AlbumsOnArtist,
                id: 'artist_albums',
                action: handleArtistAlbumsActions,
                loader: loadAlbumsForArtist,
                children: [
                  {
                    path: ':albumID/tracks',
                    Component: Tracks,
                    action: handleTrackActions,
                    loader: loadAlbumTracks,
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
        path: 'games',
        Component: Games,
        id: 'games',
        children: [
          {
            path: ':id',
            id: 'active-game',
            loader: registerPlayersAndStartGame,
            hydrateFallbackElement: <GameLoading />,
            Component: ActiveGameSession,
          },
        ],
      },
      {
        path: 'gen-ai',
        Component: GenAiHome,
        id: 'gen-ai',
        errorElement: <BaseError />,
        children: [
          {
            path: 'text',
            id: 'text',
            Component: TextGenerator,
            errorElement: <BaseError />,
          },
          {
            path: 'image',
            Component: Image,
            id: 'image',
            action: generateImageAction,
            errorElement: <BaseError />,
          },
          {
            path: 'audio',
            id: 'audio',
            Component: Audio,
            errorElement: <BaseError />,
          },
        ],
      },
      {
        path: 'privacy-policy',
        Component: PrivacyPolicy,
      },
    ],
  },
];

export default routes;
