import ReactDOM from 'react-dom/client';
import App from './app/app.jsx';
import { StrictMode } from 'react';

/**
 * This is the main entry point for the React application.
 * It creates the root element, renders the application using StrictMode and RouterProvider,
 * and mounts it to the DOM.
 */

const rootDomNode = document.querySelector('#root') as HTMLDivElement;

ReactDOM.hydrateRoot(
  rootDomNode,
  <StrictMode>
    <App />
  </StrictMode>,
  {
    onRecoverableError: (error, errorInfo) => {
      console.log(error);
      console.log(errorInfo);
    },
    onCaughtError: (error, errorInfo) => {
      console.log(error);
      console.log(errorInfo);
    },
    onUncaughtError: (error, errorInfo) => {
      console.log(error);
      console.log(errorInfo);
    }
  }
);
