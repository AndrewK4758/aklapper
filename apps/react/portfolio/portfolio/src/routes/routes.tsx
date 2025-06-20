import { lazy } from 'react';
import type { RouteObject } from 'react-router';

import Layout from '../components/layout/layout';
import PrivacyPolicy from '../components/privacy-policy/privacy-policy';
import BaseError from '../errors/base_error';
import Home from '../pages/home/home';
import LandingPage from '../pages/landing/landing';

import waiting from '../assets/images/swirly-dots-to-chrome.webp';

import { Waiting } from '@aklapper/react-shared';
import loadAlbumTracks from '../services/loaders/crud-loaders/load-album-tracks.jsx';
import loadAlbumsCount from '../services/loaders/crud-loaders/load-albums-count.jsx';
import loadArtistAlbums from '../services/loaders/crud-loaders/load-artist-albums.jsx';
import loadArtistsCount from '../services/loaders/crud-loaders/load-artists-count.jsx';

import generateImageAction from '../services/actions/generate-image-action';
import handlePromptBuilder from '../services/actions/prompt-builder-action';
import registerPlayersAndStartGame from '../services/loaders/register-players-and-start-game';

const Games = lazy(() => import('../pages/games/games.jsx'));
const ActiveGameSession = lazy(() => import('../components/games/active_game_session.jsx'));

const Crud = lazy(() => import('../pages/crud/crud.jsx'));
const AddEntry = lazy(() => import('../components/crud/add-entry/add-entry.jsx'));
const Album = lazy(() => import('../components/crud/albums/album-base.jsx'));
const Artist = lazy(() => import('../components/crud/artists/artist-base.jsx'));
const AlbumsOnArtist = lazy(() => import('../components/crud/albums/artist-albums.jsx'));
const Tracks = lazy(() => import('../components/crud/tracks/album-tracks.jsx'));

const GenAI = lazy(() => import('../pages/gen-ai/gen-ai.jsx'));
const TextGenerator = lazy(() => import('../components/gen-ai/text/text.jsx'));
const Image = lazy(() => import('../components/gen-ai/image/image.jsx'));
const Audio = lazy(() => import('../components/gen-ai/audio/audio.jsx'));

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
    element: <LandingPage />,
    hydrateFallbackElement: <Waiting src={waiting} />,
    errorElement: <BaseError />,
    id: 'landing',
  },
  {
    path: 'portfolio',
    element: <Layout />,
    children: [
      {
        index: true,
        element: <Home id='home' />,
      },
      {
        path: 'crud',
        element: <Crud />,
        children: [
          {
            path: 'artists',
            element: <Artist />,
            loader: loadArtistsCount,
            children: [
              {
                path: ':artistID/albums',
                element: <AlbumsOnArtist />,
                loader: loadArtistAlbums,
                children: [
                  {
                    path: ':albumID/tracks',
                    element: <Tracks />,
                    loader: loadAlbumTracks,
                  },
                ],
              },
            ],
          },
          {
            path: 'album',
            element: <Album />,
            loader: loadAlbumsCount,
            children: [
              {
                path: ':albumID/tracks',
                element: <Tracks />,
                loader: loadAlbumTracks,
              },
            ],
          },
          {
            path: 'add-entry',
            element: <AddEntry />,
          },
        ],
      },
      {
        path: 'games',
        action: registerPlayersAndStartGame,
        element: <Games />,
        id: 'games',
        children: [
          {
            index: true,
            path: ':id',
            id: 'active-game',
            element: <ActiveGameSession />,
          },
        ],
      },
      {
        path: 'gen-ai',
        element: <GenAI />,
        id: 'gen-ai',
        action: handlePromptBuilder,
        errorElement: <BaseError />,
        children: [
          {
            path: 'text',
            id: 'text',
            element: <TextGenerator />,
            errorElement: <BaseError />,
          },
          {
            path: 'image',
            element: <Image />,
            id: 'image',
            action: generateImageAction,
            errorElement: <BaseError />,
          },
          {
            path: 'audio',
            id: 'audio',
            element: <Audio />,
            errorElement: <BaseError />,
          },
        ],
      },
      {
        path: 'privacy-policy',
        element: <PrivacyPolicy />,
      },
    ],
  },
];

export default routes;
