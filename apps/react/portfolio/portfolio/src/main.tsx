import '@mui/material-pigment-css/styles.css';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import App from './app/app';
import { routes } from './routes/routes';

const router = createBrowserRouter(routes);

/**
 * This is the main entry point for the React application.
 * It creates the root element, renders the application using StrictMode and RouterProvider,
 * and mounts it to the DOM.
 */

const rootDomNode = document.querySelector('#root') as HTMLDivElement;

createRoot(rootDomNode).render(
  <App>
    <RouterProvider router={router} />
  </App>,
);
