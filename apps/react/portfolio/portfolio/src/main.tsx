import '@mui/material-pigment-css/styles.css';
import { createRoot } from 'react-dom/client';

import App from './app/app';
console.log(import.meta.env);
/**
 * This is the main entry point for the React application.
 * It creates the root element, renders the application using StrictMode and RouterProvider,
 * and mounts it to the DOM.
 */

const rootDomNode = document.querySelector('#root') as HTMLDivElement;

createRoot(rootDomNode).render(<App />);
