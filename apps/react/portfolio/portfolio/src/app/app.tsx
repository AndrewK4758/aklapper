import DefaultPropsProvider from '@mui/material/DefaultPropsProvider';
import { createBrowserRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { routes } from '../routes/routes';
import '../styles/main-styles.css';
import { DEFAULT_PROPS } from '../styles/themes/default_props';

const router = createBrowserRouter(routes);

export default function App() {
  return (
    <DefaultPropsProvider value={DEFAULT_PROPS}>
      <RouterProvider router={router} />
    </DefaultPropsProvider>
  );
}
