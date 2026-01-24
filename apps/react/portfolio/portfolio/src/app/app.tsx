import { createBrowserRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import routes from '@routes/routes';
import '@styles/main-styles.css';

const router = createBrowserRouter(routes);

export default function App() {
  return (
    // <ThemeProvider theme={Theme} defaultMode={'system'}>
    //   <CssBaseline enableColorScheme={true} />
    <RouterProvider router={router} />
    // </ThemeProvider>
  );
}
