import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { createBrowserRouter, RouterProvider } from 'react-router';
import routes from '../routes/routes';
import { GamesTheme as Theme } from '../styles/games-theme';

const router = createBrowserRouter(routes);

const App = () => (
  <ThemeProvider theme={Theme}>
    <CssBaseline enableColorScheme />
    <RouterProvider router={router} />
  </ThemeProvider>
);

export default App;
