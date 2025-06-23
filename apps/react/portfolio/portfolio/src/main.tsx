import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { StrictMode } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';
import routes from './routes/routes';
import './styles/main-styles.css';
import Theme from './styles/themes/theme';

const router = createBrowserRouter(routes);

/**
 * This is the main entry point for the React application.
 * It creates the root element, renders the application using StrictMode and RouterProvider,
 * and mounts it to the DOM.
 */

const rootDomNode = document.querySelector('#root') as HTMLDivElement;

hydrateRoot(
  rootDomNode,
  <StrictMode>
    <ThemeProvider theme={Theme} defaultMode='dark'>
      <CssBaseline enableColorScheme />
      <RouterProvider router={router} />
    </ThemeProvider>
  </StrictMode>,
  {
    onRecoverableError: (error, errorInfo) => {
      console.log(`Uncaught Error: ${JSON.stringify(error)}`);
      console.log(`Uncaught Error: ${JSON.stringify(errorInfo)}`);
    },
    onCaughtError: (error, errorInfo) => {
      console.log(`Uncaught Error: ${JSON.stringify(error)}`);
      console.log(`Uncaught Error: ${JSON.stringify(errorInfo)}`);
    },
    onUncaughtError: (error, errorInfo) => {
      console.log(`Uncaught Error: ${JSON.stringify(error)}`);
      console.log(`Uncaught Error: ${JSON.stringify(errorInfo)}`);
    },
  },
);
