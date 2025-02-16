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
    id: 'layout',
    children: [
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
            element: <ActiveGameSession />
          }
        ]
      },
      {
        path: 'crud',
        element: <Crud />,
        id: 'crud',
        children: [
          {
            index: true,
            path: 'add-entry',
            id: 'add-entry',
            element: <AddEntry />
          },
          {
            path: 'artists',
            element: <Artist />,
            id: 'artists',
            loader: loadArtistsCount,
            children: [
              {
                path: ':artistID/albums',
                loader: loadArtistAlbums,
                id: 'artist-albums',
                element: <AlbumsOnArtist />,
                children: [
                  {
                    path: ':albumID/tracks',
                    id: 'album-tracks',
                    loader: loadAlbumTracks,
                    element: <Tracks />
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
            children: [
              {
                path: ':albumID/tracks',
                id: 'tracks',
                element: <Tracks />,
                loader: loadAlbumTracks
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
        children: [
          {
            path: 'text',
            id: 'text',
            element: <TextGenerator />
          },
          {
            path: 'image',
            element: <Image />,
            id: 'image',
            action: generateImageAction
          },
          {
            path: 'audio',
            id: 'audio',
            element: <Audio />
          }
        ]
      },
      {
        path: 'privacy-policy',
        id: 'privacy-policy',
        element: <PrivacyPolicy />
      }
    ]
  }
];

export default routes;
