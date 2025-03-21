import { RouteObject } from 'react-router';
import Layout from '../components/layout/Layout';
import Lobby from '../components/lobby/lobby';
import { NoGameError, NotEnoughPlayersError } from '../errors/error';
import ActiveGameSession from '../pages/active_game_session';
import GameDetails from '../pages/game_details';
import GamesList from '../pages/games_list';
import Home from '../pages/home-page';
import RegisterPlayerAndAvatarOnGame from '../pages/register_player_and_avatar_on_game';
import registerGameInstanceOnServerAction from '../services/games/action_functions/register_game_on_server_action';
import registerPlayerAndAvatarAction from '../services/games/action_functions/register_player_avatar_action';
import loadGameList from '../services/games/loader_functions/load_game_list';
import loadPlayerAvatarRegisterFilterData from '../services/games/loader_functions/load_register_player_avatar_data_and_filter';

export default [
  {
    path: '/',
    element: <Layout />,
    hydrateFallbackElement: <h1>Loading</h1>,
    children: [
      {
        index: true,
        element: <Home />
      },
      {
        path: 'lobby',
        id: 'lobby',
        element: <Lobby />
      },
      {
        path: 'games',
        id: 'gameList',
        loader: loadGameList,
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
] as RouteObject[];
