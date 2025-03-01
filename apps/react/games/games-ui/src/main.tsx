import  ThemeProvider from '@mui/material/styles/ThemeProvider';
import CssBaseline from '@mui/material/CssBaseline';
import { StrictMode } from 'react';
import * as ReactDOM from 'react-dom/client';
import App from './app/App';
import { GamesTheme as Theme } from './styles/games-theme';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

root.render(
  <StrictMode>
    <ThemeProvider theme={Theme}>
      <CssBaseline enableColorScheme />
      <App />
    </ThemeProvider>
    ,
  </StrictMode>
);
