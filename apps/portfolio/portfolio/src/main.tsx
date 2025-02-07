import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import './styles/main-styles.css';
import App from './app/app';

/**
 * This is the main entry point for the React application.
 * It creates the root element, renders the application using StrictMode and RouterProvider,
 * and mounts it to the DOM.
 */

ReactDOM.hydrateRoot(
  document.getElementById('root') as HTMLDivElement,
  <StrictMode>
    <App />
  </StrictMode>
);
