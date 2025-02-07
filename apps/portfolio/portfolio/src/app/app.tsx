import CssBaseline from '@mui/material/CssBaseline';
import ThemeProvider from '@mui/material/styles/ThemeProvider';
import type { FC, ReactElement } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import routes from '../routes/routes';
import Theme from '../styles/theme';

const router = createMemoryRouter(routes, {
  basename: '',
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  hydrationData: (window as any).__INITIAL_DATA__
});

/**
 * This is the root component of the application.
 * It provides the necessary context providers for styling, date localization, and Google OAuth.
 *
 * @returns {ReactElement<AppProps>} The rendered App component with the Layout component and context providers.
 */

const App: FC = (): ReactElement => (
  <ThemeProvider theme={Theme}>
    <CssBaseline enableColorScheme />
    <RouterProvider router={router} />
  </ThemeProvider>
);

export default App;
