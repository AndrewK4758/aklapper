import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import type { FC, ReactElement } from 'react';
import '../styles/main-styles.css';
import Theme from '../styles/theme.jsx';

export interface AppProps {
  Router: ReactElement;
}

/**
 * This is the root component of the application.
 * It provides the necessary context providers for styling, date localization, and Google OAuth.
 *
 * @returns {ReactElement} The rendered App component with the Layout component and context providers.
 */

const App: FC<AppProps> = ({ Router }: AppProps): ReactElement => (
  <ThemeProvider theme={Theme} noSsr={false} defaultMode='dark'>
    <CssBaseline />
    {Router}
  </ThemeProvider>
);

export default App;
