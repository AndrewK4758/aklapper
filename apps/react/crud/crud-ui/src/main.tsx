import CssBaseline from '@mui/material/CssBaseline';
import { StrictMode } from 'react';
import * as ReactDOM from 'react-dom/client';
import App from './app/app';
import './styles/styles.css';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <StrictMode>
    <CssBaseline />
    <App />
  </StrictMode>
);
