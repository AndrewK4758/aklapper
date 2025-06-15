import { StrictMode } from 'react';
import { hydrateRoot } from 'react-dom/client';
import App from './app/app';

/**
 * This is the main entry point for the React application.
 * It creates the root element, renders the application using StrictMode and RouterProvider,
 * and mounts it to the DOM.
 */

const rootDomNode = document.querySelector('#root') as HTMLDivElement;

hydrateRoot(
  rootDomNode,
  <StrictMode>
    <App />,
  </StrictMode>,
  {
    onRecoverableError: (error, errorInfo) => {
      console.log(`Uncaught Error: ${error}`);
      console.log(`Uncaught Error: ${errorInfo}`);
    },
    onCaughtError: (error, errorInfo) => {
      console.log(`Uncaught Error: ${error}`);
      console.log(`Uncaught Error: ${errorInfo}`);
    },
    onUncaughtError: (error, errorInfo) => {
      console.log(`Uncaught Error: ${error}`);
      console.log(`Uncaught Error: ${errorInfo}`);
    },
  },
);
