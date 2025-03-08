import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';
import App from './app/app.jsx';
import routes from './routes/routes.jsx';
// import ServerError from './errors/server-error.js';

const router = createBrowserRouter(routes);
/**
 * This is the main entry point for the React application.
 * It creates the root element, renders the application using StrictMode and RouterProvider,
 * and mounts it to the DOM.
 */

const rootDomNode = document.querySelector('#root') as HTMLDivElement;

ReactDOM.hydrateRoot(
  rootDomNode,
  <StrictMode>
    <App Router={<RouterProvider router={router} />} />
  </StrictMode>,
  {
    onRecoverableError: (error, errorInfo) => {
      console.log(`Recoverable Error: ${error}`);
      console.log(`Recoverable Error: ${errorInfo}`);
    },
    onCaughtError: (error, errorInfo) => {
      console.log(`Caught Error: ${error}`);
      console.log(`Caught Error: ${errorInfo}`);
    },
    onUncaughtError: (error, errorInfo) => {
      console.log(`Uncaught Error: ${error}`);
      console.log(`Uncaught Error: ${errorInfo}`);
    }
  }
);
