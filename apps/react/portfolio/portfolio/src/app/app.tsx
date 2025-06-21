import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import type { ReactElement } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router';
import routes from '../routes/routes';
import '../styles/main-styles.css';
import Theme from '../styles/themes/theme';

const router = createBrowserRouter(routes);

/**
 * This is the root component of the application.
 * It provides the necessary context providers for styling, date localization, and Google OAuth.
 *
 * @returns {ReactElement} The rendered App component with the Layout component and context providers.
 */

export default function App(): ReactElement {
  return (
    <ThemeProvider theme={Theme} noSsr={false} defaultMode='dark'>
      <CssBaseline />
      <RouterProvider router={router} />
    </ThemeProvider>
  );
}
