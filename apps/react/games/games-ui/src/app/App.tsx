import CssBaseline from '@mui/material/CssBaseline';
import ThemeProvider from '@mui/material/styles/ThemeProvider';
import { createBrowserRouter, RouterProvider } from 'react-router';
import Layout from '../components/layout/Layout';
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
import { GamesTheme as Theme } from '../styles/games-theme';

const router = createBrowserRouter([
  {
    path: '/',
    Component: Layout,
    hydrateFallbackElement: <h1>Loading</h1>,
    children: [
      {
        index: true,
        Component: Home
      },
      {
        path: 'games',
        id: 'gameList',
        loader: loadGameList,
        children: [
          {
            index: true,
            Component: GamesList
          },
          {
            path: ':id',
            action: registerGameInstanceOnServerAction,
            errorElement: <NoGameError />,
            children: [
              {
                index: true,
                Component: GameDetails
              },
              {
                path: 'register',
                loader: loadPlayerAvatarRegisterFilterData,
                Component: RegisterPlayerAndAvatarOnGame,
                id: 'registerData',
                errorElement: <NoGameError />
              },
              {
                path: 'play',
                action: registerPlayerAndAvatarAction,
                Component: ActiveGameSession,
                id: 'gameBoard',
                errorElement: <NotEnoughPlayersError />
              }
            ]
          }
        ]
      }
    ]
  }
]);

const App = () => (
  <ThemeProvider theme={Theme}>
    <CssBaseline enableColorScheme />
    <RouterProvider router={router} />
  </ThemeProvider>
);

export default App;
