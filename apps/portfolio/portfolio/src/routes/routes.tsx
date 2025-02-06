import { Waiting } from '@aklapper/react-shared';
import { lazy } from 'react';
import type { RouteObject } from 'react-router';
import waiting from '../assets/swirly-dots-to-chrome.webp';
import Layout from '../components/layout/layout';
import PrivacyPolicy from '../components/privacy-policy/privacy-policy';
import emailFormAction from '../services/actions/email-form-action';
import generateImageAction from '../services/actions/generate-image-action';
import handlePromptBuilder from '../services/actions/prompt-builder-action';
import loadAlbumTracks from '../services/loaders/crud-loaders/load-album-tracks';
import loadAlbumsCount from '../services/loaders/crud-loaders/load-albums-count';
import loadArtistAlbums from '../services/loaders/crud-loaders/load-artist-albums';
import loadArtistsCount from '../services/loaders/crud-loaders/load-artists-count';
import registerPlayersAndStartGame from '../services/loaders/register-players-and-start-game';

const Games = lazy(() => import('../pages/games/games'));
const ActiveGameSession = lazy(() => import('../components/games/active_game_session'));

const Crud = lazy(() => import('../pages/crud/crud'));
const AddEntry = lazy(() => import('../components/crud/add-entry/add-entry'));
const Album = lazy(() => import('../components/crud/albums/album-base'));
const Artist = lazy(() => import('../components/crud/artists/artist-base'));
const AlbumsOnArtist = lazy(() => import('../components/crud/albums/artist-albums'));
const Tracks = lazy(() => import('../components/crud/tracks/album-tracks'));

const GenAI = lazy(() => import('../pages/gen-ai/gen-ai'));
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
    Component: Layout,
    action: emailFormAction,
    children: [
      {
        path: 'games',
        action: registerPlayersAndStartGame,
        Component: Games,
        children: [
          {
            index: true,
            path: ':id',
            Component: ActiveGameSession
          }
        ]
      },
      {
        path: 'crud',
        Component: Crud,
        hydrateFallbackElement: <Waiting src={waiting} />,
        children: [
          {
            index: true,
            path: 'add-entry',
            Component: AddEntry
          },
          {
            path: 'artists',
            Component: Artist,
            loader: loadArtistsCount,
            children: [
              {
                path: ':artistID/albums',
                loader: loadArtistAlbums,
                Component: AlbumsOnArtist,
                children: [
                  {
                    path: ':albumID/tracks',
                    loader: loadAlbumTracks,
                    Component: Tracks
                  }
                ]
              }
            ]
          },
          {
            path: 'albums',
            Component: Album,
            loader: loadAlbumsCount,
            children: [
              {
                path: ':albumID/tracks',
                Component: Tracks,
                loader: loadAlbumTracks
              }
            ]
          }
        ]
      },
      {
        path: 'gen-ai',
        Component: GenAI,
        action: handlePromptBuilder,
        children: [
          {
            path: 'text',
            Component: TextGenerator
          },
          {
            path: 'image',
            Component: Image,
            action: generateImageAction
          },
          {
            path: 'audio',
            Component: Audio
          }
        ]
      },
      {
        path: 'privacy-policy',
        Component: PrivacyPolicy
      }
    ]
  }
];

export default routes;
