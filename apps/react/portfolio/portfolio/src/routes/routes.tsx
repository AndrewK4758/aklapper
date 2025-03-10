import { lazy } from 'react';
import type { RouteObject } from 'react-router';
import Layout from '../components/layout/layout.jsx';
import emailFormAction from '../services/actions/email-form-action.jsx';
import PrivacyPolicy from '../components/privacy-policy/privacy-policy.jsx';
import generateImageAction from '../services/actions/generate-image-action.jsx';
import handlePromptBuilder from '../services/actions/prompt-builder-action.jsx';
import loadAlbumTracks from '../services/loaders/crud-loaders/load-album-tracks.jsx';
import loadAlbumsCount from '../services/loaders/crud-loaders/load-albums-count.jsx';
import loadArtistAlbums from '../services/loaders/crud-loaders/load-artist-albums.jsx';
import loadArtistsCount from '../services/loaders/crud-loaders/load-artists-count.jsx';
import registerPlayersAndStartGame from '../services/loaders/register-players-and-start-game.jsx';
import BaseError from '../errors/redirect-to-home.js';

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
    element: <Layout />,
    action: emailFormAction,
    errorElement: <BaseError />,
    id: 'layout',
    children: [
      {
        path: 'games',
        action: registerPlayersAndStartGame,
        element: <Games />,
        errorElement: <BaseError />,
        id: 'games',
        children: [
          {
            index: true,
            path: ':id',
            id: 'active-game',
            element: <ActiveGameSession />,
            errorElement: <BaseError />
          }
        ]
      },
      {
        path: 'crud',
        element: <Crud />,
        id: 'crud',
        errorElement: <BaseError />,
        children: [
          {
            index: true,
            path: 'add-entry',
            id: 'add-entry',
            element: <AddEntry />,
            errorElement: <BaseError />
          },
          {
            path: 'artists',
            element: <Artist />,
            id: 'artists',
            loader: loadArtistsCount,
            errorElement: <BaseError />,
            children: [
              {
                path: ':artistID/albums',
                loader: loadArtistAlbums,
                id: 'artist-albums',
                element: <AlbumsOnArtist />,
                errorElement: <BaseError />,
                children: [
                  {
                    path: ':albumID/tracks',
                    id: 'album-tracks',
                    loader: loadAlbumTracks,
                    element: <Tracks />,
                    errorElement: <BaseError />
                  }
                ]
              }
            ]
          },
          {
            path: 'albums',
            element: <Album />,
            id: 'albums',
            loader: loadAlbumsCount,
            errorElement: <BaseError />,
            children: [
              {
                path: ':albumID/tracks',
                id: 'tracks',
                element: <Tracks />,
                loader: loadAlbumTracks,
                errorElement: <BaseError />
              }
            ]
          }
        ]
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
            errorElement: <BaseError />
          },
          {
            path: 'image',
            element: <Image />,
            id: 'image',
            action: generateImageAction,
            errorElement: <BaseError />
          },
          {
            path: 'audio',
            id: 'audio',
            element: <Audio />,
            errorElement: <BaseError />
          }
        ]
      },
      {
        path: 'privacy-policy',
        id: 'privacy-policy',
        element: <PrivacyPolicy />,
        errorElement: <BaseError />
      }
    ]
  }
];

export default routes;
