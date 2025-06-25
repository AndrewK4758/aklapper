import { StrictMode } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';
import App from './app/app';
import routes from './routes/routes';
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
    <App>
      <RouterProvider router={router} />
    </App>
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
