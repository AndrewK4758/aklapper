import { Waiting } from '@aklapper/react-shared';
import { lazy } from 'react';
import type { RouteObject } from 'react-router';
import waiting from '../assets/images/swirly-dots-to-chrome.webp';
import PrivacyPolicy from '../components/privacy-policy/privacy-policy';
import BaseError from '../errors/base_error';
import Home from '../pages/home/home';
import LandingPage from '../pages/landing/landing';

import loadAlbumsCount from '../services/loaders/crud-loaders/load-albums-count';
import loadArtistsCount from '../services/loaders/crud-loaders/load-artists-count';

import Layout from '../components/layout/layout';
import Crud from '../pages/crud/crud';
import Games from '../pages/games/games';
import GenAiHome from '../pages/gen-ai/gen-ai';
import generateImageAction from '../services/actions/generate-image-action';
// import handlePromptBuilder from '../services/actions/prompt-builder-action';
import loadTracksCount from '../services/loaders/crud-loaders/load_tracks_count';
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
        element: <Home />,
      },
      {
        path: 'crud',
        element: <Crud />,
        hydrateFallbackElement: <Waiting src={waiting} />,
        children: [
          {
            path: 'artists',
            element: <Artist />,
            loader: loadArtistsCount,
            children: [
              {
                path: ':artistID/albums',
                element: <AlbumsOnArtist />,
                children: [
                  {
                    path: ':albumID/tracks',
                    element: <Tracks />,
                    loader: loadTracksCount,
                  },
                ],
              },
            ],
          },
          {
            path: 'albums',
            element: <Album />,
            loader: loadAlbumsCount,
            children: [
              {
                path: ':albumID/tracks',
                element: <Tracks />,
                loader: loadTracksCount,
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
        element: <GenAiHome />,
        id: 'gen-ai',
        // action: handlePromptBuilder,
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
