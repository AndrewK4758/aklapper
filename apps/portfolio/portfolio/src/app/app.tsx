import CssBaseline from '@mui/material/CssBaseline';
import ThemeProvider from '@mui/material/styles/ThemeProvider';
import type { FC, JSX } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import routes from '../routes/routes';
import Theme from '../styles/theme';

export const router = createBrowserRouter(routes);

/**
 * This is the root component of the application.
 * It provides the necessary context providers for styling, date localization, and Google OAuth.
 *
 * @returns {JSX.Element} The rendered App component with the Layout component and context providers.
 */

const App: FC = (): JSX.Element => (
  <ThemeProvider theme={Theme}>
    <CssBaseline enableColorScheme />
    <RouterProvider router={router} />
  </ThemeProvider>
);

export default App;
