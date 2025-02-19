import CssBaseline from '@mui/material/CssBaseline';
import ThemeProvider from '@mui/material/styles/ThemeProvider';
import type { FC, ReactElement } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router';
import routes from '../routes/routes.jsx';
import Theme from '../styles/theme.jsx';
import '../styles/main-styles.css';

const router = createBrowserRouter(routes);

/**
 * This is the root component of the application.
 * It provides the necessary context providers for styling, date localization, and Google OAuth.
 *
 * @returns {ReactElement<AppProps>} The rendered App component with the Layout component and context providers.
 */

const App: FC = (): ReactElement => (
  <ThemeProvider theme={Theme}>
    <CssBaseline />
    <RouterProvider router={router} />
  </ThemeProvider>
);

export default App;

/**
  <html lang="en">
    <head>
      <meta char-set="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>
        Developer Portfolio for Andrew Klapper. This shows multiple projects that showcase distinct programming styles.
        Each project uses React as the front-end / ui, jest/vitest for testing, github actions and GCP for simple ci/cd.
        Please feel free to click the github icon in the contact section for a full review of the monorepo
      </title>
      <meta
        name="title"
        content="Developer Portfolio for Andrew Klapper. This shows multiple projects that showcase distinct programming styles. Each project uses React as the front-end / ui, jest/vitest for testing, github actions and GCP for simple ci/cd. Please feel free to click the github icon in the contact section for a full review of the monorepo"
      />
      <meta name="description" content="Personal developer portfolio for Andrew Klapper" />
      <meta name="keywords" content="Typescript, react, portfolio, developer" />
      <meta name="robots" content="index, follow" />
      <meta name="language" content="English" />
      <meta name="author" content="Andrew Klapper" />
      <link rel="icon" type="image/x-icon" href="/favicon.ico" />
      <link rel="preload" href="/LTYPE.TTF" as="font" type="font/ttf" cross-origin /> 
      <link rel="preload" href="/LTYPEB.TTF" as="font" type="font/ttf" cross-origin />
      <link rel="stylesheet" href="/browser.css" /> 
      </head>

      <body>
        <div id="root">
        </div>
    </body>
  </html>

 */
