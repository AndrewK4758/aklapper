import ReactDOM from 'react-dom/client';
import App from './app/app.jsx';

/**
 * This is the main entry point for the React application.
 * It creates the root element, renders the application using StrictMode and RouterProvider,
 * and mounts it to the DOM.
 */

const rootDomNode = document.querySelector('#root') as HTMLDivElement;

ReactDOM.hydrateRoot(rootDomNode, <App />, {
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
});
