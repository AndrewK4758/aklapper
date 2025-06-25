import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import type { ReactNode } from 'react';
import '../styles/main-styles.css';
import Theme from '../styles/themes/theme';

export default function App({ children }: { children: ReactNode | ReactNode[] }) {
  return (
    <ThemeProvider theme={Theme}>
      <CssBaseline enableColorScheme />
      {children}
    </ThemeProvider>
  );
}
