import { Waiting } from '@aklapper/react-shared';
import { lazy } from 'react';
import { RouteObject } from 'react-router';
import waiting from '../assets/swirly-dots-to-chrome.webp';
import Layout from '../components/layout/Layout';
import { NoGameError, NotEnoughPlayersError } from '../errors/error';
import Home from '../pages/home-page';
import handleNewPlayerSubmit from '../services/games/action_functions/handle_new_player_submit';
import registerGameInstanceOnServerAction from '../services/games/action_functions/register_game_on_server_action';
import registerPlayerAndAvatarAction from '../services/games/action_functions/register_player_avatar_action';
import loadGameList from '../services/games/loader_functions/load_game_list';
import loadLobbyData from '../services/games/loader_functions/load_lobby_data';
import loadPlayerAvatarRegisterFilterData from '../services/games/loader_functions/load_register_player_avatar_data_and_filter';

const GamesList = lazy(() => import('../pages/games_list'));
const GameDetails = lazy(() => import('../pages/game_details'));
const RegisterPlayerAndAvatarOnGame = lazy(() => import('../pages/register_player_and_avatar_on_game'));
const ActiveGameSession = lazy(() => import('../pages/active_game_session'));
const Lobby = lazy(() => import('../components/lobby/lobby'));

const routes: RouteObject[] = [
  {
    path: '/',
    element: <Layout />,
    hydrateFallbackElement: <Waiting src={waiting} />,
    id: 'gameList',
    loader: loadGameList,
    children: [
      {
        index: true,
        element: <Home />
      },
      {
        path: 'lobby',
        action: handleNewPlayerSubmit,
        id: 'lobby',
        element: <Lobby />,
        loader: loadLobbyData
      },
      {
        path: 'games',
        children: [
          {
            index: true,
            element: <GamesList />
          },
          {
            path: ':id',
            action: registerGameInstanceOnServerAction,
            errorElement: <NoGameError />,
            children: [
              {
                index: true,
                element: <GameDetails />
              },
              {
                path: 'register',
                loader: loadPlayerAvatarRegisterFilterData,
                element: <RegisterPlayerAndAvatarOnGame />,
                id: 'registerData',
                errorElement: <NoGameError />
              },
              {
                path: 'play',
                action: registerPlayerAndAvatarAction,
                element: <ActiveGameSession />,
                id: 'gameBoard',
                errorElement: <NotEnoughPlayersError />
              }
            ]
          }
        ]
      }
    ]
  }
];

export default routes;
