// import { lazy } from 'react';
import type { RouteObject } from 'react-router';

// import PrivacyPolicy from '../components/privacy-policy/privacy-policy.jsx';
// import Layout from '../components/layout/layout';
import Layout from '../components/layout/layout';
import PrivacyPolicy from '../components/privacy-policy/privacy-policy';
import BaseError from '../errors/base_error';
import Home from '../pages/home/home';
import LandingPage from '../pages/landing/landing';

// import emailFormAction from '../services/actions/email-form-action.jsx';
// import generateImageAction from '../services/actions/generate-image-action.jsx';
// import handlePromptBuilder from '../services/actions/prompt-builder-action.jsx';
// import loadAlbumTracks from '../services/loaders/crud-loaders/load-album-tracks.jsx';
// import loadAlbumsCount from '../services/loaders/crud-loaders/load-albums-count.jsx';
// import loadArtistAlbums from '../services/loaders/crud-loaders/load-artist-albums.jsx';
// import loadArtistsCount from '../services/loaders/crud-loaders/load-artists-count.jsx';
// import registerPlayersAndStartGame from '../services/loaders/register-players-and-start-game.jsx';

// const Games = lazy(() => import('../pages/games/games.jsx'));
// const ActiveGameSession = lazy(() => import('../components/games/active_game_session.jsx'));

// const Crud = lazy(() => import('../pages/crud/crud.jsx'));
// const AddEntry = lazy(() => import('../components/crud/add-entry/add-entry.jsx'));
// const Album = lazy(() => import('../components/crud/albums/album-base.jsx'));
// const Artist = lazy(() => import('../components/crud/artists/artist-base.jsx'));
// const AlbumsOnArtist = lazy(() => import('../components/crud/albums/artist-albums.jsx'));
// const Tracks = lazy(() => import('../components/crud/tracks/album-tracks.jsx'));

// const GenAI = lazy(() => import('../pages/gen-ai/gen-ai.jsx'));
// const TextGenerator = lazy(() => import('../components/gen-ai/text/text.jsx'));
// const Image = lazy(() => import('../components/gen-ai/image/image.jsx'));
// const Audio = lazy(() => import('../components/gen-ai/audio/audio.jsx'));

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
    element: <LandingPage id='landing-page' />,
    errorElement: <BaseError />,
    id: 'landing',
  },
  {
    path: 'home',
    element: <Layout />,
    children: [
      {
        index: true,
        element: <Home id='home' />,
      },
      {
        path: 'privacy-policy',
        element: <PrivacyPolicy />,
      },
    ],
  },
];

export default routes;
