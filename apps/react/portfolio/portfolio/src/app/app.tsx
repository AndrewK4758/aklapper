import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { createBrowserRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import routes from '@routes/routes';
import '@styles/main-styles.css';
import Theme from '@styles/themes/theme';

const router = createBrowserRouter(routes);

export default function App() {
  return (
    <ThemeProvider theme={Theme} defaultMode={'system'}>
      <CssBaseline enableColorScheme={true} />
      <RouterProvider router={router} />
    </ThemeProvider>
  );
}
