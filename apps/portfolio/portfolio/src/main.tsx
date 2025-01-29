import ReactDOM from 'react-dom/client';
import { StrictMode } from 'react';
import './styles/main-styles.css';
import App from './app/app';

/**
 * This is the main entry point for the React application.
 * It creates the root element, renders the application using StrictMode and RouterProvider,
 * and mounts it to the DOM.
 */

ReactDOM.createRoot(document.getElementById('root') as HTMLDivElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
