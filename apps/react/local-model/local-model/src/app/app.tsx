import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { createBrowserRouter, RouterProvider } from 'react-router';
import routes from '../routes/routes';
import '../styles/styles.css';
import Theme from '../styles/theme';

const router = createBrowserRouter(routes);

export function App() {
  return (
    <ThemeProvider theme={Theme}>
      <CssBaseline />
      <RouterProvider router={router} />
    </ThemeProvider>
  );
}

export default App;
