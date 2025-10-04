import CssBaseline from '@mui/material/CssBaseline';
// import DefaultPropsProvider from '@mui/material/DefaultPropsProvider';
import { createBrowserRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import routes from '../routes/routes';
// import { DEFAULT_PROPS } from '../styles/themes/default_props';
import '../styles/main-styles.css';
import { ThemeProvider } from '@mui/material/styles';
import Theme from '../styles/themes/theme';

const router = createBrowserRouter(routes);

export default function App() {
  return (
    <ThemeProvider theme={Theme}>
      <CssBaseline />
      <RouterProvider router={router} />
    </ThemeProvider>
  );
}
