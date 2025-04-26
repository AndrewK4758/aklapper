import { Waiting } from '@aklapper/react-shared';
import { lazy } from 'react';
import type { RouteObject } from 'react-router';
import waiting from '../assets/swirly-dots-to-chrome.webp';
import Layout from '../components/layout/Layout';
import { NoGameError, NotEnoughPlayersError } from '../errors/error';
import Home from '../pages/home/home-page';
import registerGameInstanceOnServerAction from '../services/games/action_functions/register_game_on_server_action';
import registerPlayerAndAvatarAction from '../services/games/action_functions/register_player_avatar_action';
import loadGameList from '../services/games/loader_functions/load_game_list';
import loadLobbyData from '../services/games/loader_functions/load_lobby_data';
import loadPlayerAvatarRegisterFilterData from '../services/games/loader_functions/load_register_player_avatar_data_and_filter';

const RegisterPlayerAndAvatarOnGame = lazy(() => import('../pages/register_player_and_avatar_on_game'));
const ActiveGameSession = lazy(() => import('../pages/active_game_session'));
const Lobby = lazy(() => import('../pages/lobby/lobby'));

export default [
  {
    path: '/',
    element: <Layout key={'layout'} />,
    hydrateFallbackElement: <Waiting key={'waiting'} src={waiting} />,
    id: 'gameList',
    loader: loadGameList,
    children: [
      {
        index: true,
        element: <Home key={'home'} />,
      },
      {
        path: 'lobby',
        id: 'lobby',
        element: <Lobby key={'lobby'} />,
        loader: loadLobbyData,
        children: [
          {
            path: ':id',
            action: registerGameInstanceOnServerAction,
            errorElement: <NoGameError key={'no-game-error'} />,
            children: [
              {
                path: 'register',
                loader: loadPlayerAvatarRegisterFilterData,
                element: <RegisterPlayerAndAvatarOnGame />,
                id: 'registerData',
                errorElement: <NoGameError />,
              },
              {
                path: 'play',
                action: registerPlayerAndAvatarAction,
                element: <ActiveGameSession />,
                id: 'gameBoard',
                errorElement: <NotEnoughPlayersError />,
              },
            ],
          },
        ],
      },
    ],
  },
] as RouteObject[];
