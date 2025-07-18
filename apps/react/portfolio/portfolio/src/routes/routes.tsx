import { Waiting } from '@aklapper/react-shared';
import { lazy } from 'react';
import type { RouteObject } from 'react-router';
import waiting from '../assets/images/swirly-dots-to-chrome.webp';
import Layout from '../components/layout/layout';
import GameLoading from '../components/loading/loading';
import PrivacyPolicy from '../components/privacy-policy/privacy-policy';
import BaseError from '../errors/base_error';
import Crud from '../pages/crud/crud';
import Games from '../pages/games/games';
import GenAiHome from '../pages/gen-ai/gen-ai';
import Home from '../pages/home/home';
import LandingPage from '../pages/landing/landing';
import handleArtistAlbumsActions from '../services/actions/crud-actions/handle_album_on_artist_actions';
import handleArtistActions from '../services/actions/crud-actions/handle_artist_actions';
import handleTrackActions from '../services/actions/crud-actions/handle_track_actions';
import generateImageAction from '../services/actions/generate-image-action';
import loadAlbumTracks from '../services/loaders/crud-loaders/load-album-tracks';
import loadAlbums from '../services/loaders/crud-loaders/load-albums';
import loadArtistsAndCount from '../services/loaders/crud-loaders/load-artists';
import loadAlbumsForArtist from '../services/loaders/crud-loaders/load_albums_for_artist';
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

export const routes: RouteObject[] = [
  {
    id: 'landing',
    path: '/',
    Component: LandingPage,
    hydrateFallbackElement: <Waiting src={waiting} />,
    errorElement: <BaseError />,
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
            hydrateFallbackElement: <GameLoading />,
          },
        ],
      },
      {
        id: 'gen-ai',
        path: 'gen-ai',
        Component: GenAiHome,
        errorElement: <BaseError />,
        children: [
          {
            id: 'text',
            path: 'text',
            Component: TextGenerator,
            errorElement: <BaseError />,
          },
          {
            id: 'image',
            path: 'image',
            Component: Image,
            action: generateImageAction,
            errorElement: <BaseError />,
          },
          {
            id: 'audio',
            path: 'audio',
            Component: Audio,
            errorElement: <BaseError />,
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

// export default routes;
