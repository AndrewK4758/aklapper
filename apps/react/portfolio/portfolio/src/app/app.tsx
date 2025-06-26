import DefaultPropsProvider from '@mui/material/DefaultPropsProvider';
import type { ReactNode } from 'react';
import '../styles/main-styles.css';
import { DEFAULT_PROPS } from '../styles/themes/default_props';

export default function App({ children }: { children: ReactNode }) {
  return <DefaultPropsProvider value={DEFAULT_PROPS}>{children}</DefaultPropsProvider>;
  // <ThemeProvider theme={Theme}>
  {
    /* <CssBaseline enableColorScheme /> */
  }

  // </ThemeProvider>
}
