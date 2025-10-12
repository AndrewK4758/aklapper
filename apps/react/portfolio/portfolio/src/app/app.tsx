import CssBaseline from '@mui/material/CssBaseline';
import { createBrowserRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import routes from '../routes/routes';
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
