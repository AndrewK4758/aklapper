import type { SxProps } from '@mui/material/styles';
import { centerFlex, flexColumnStyles } from './pages-styles.jsx';
import Theme from './themes/theme.js';

export const loadingPaperStyles: SxProps<typeof Theme> = {
  ...flexColumnStyles,
  width: '100vw',
  height: '100%',
  justifyContent: 'center',
};

export const loadingBarBox: SxProps = {
  flex: '0 1 80%',
};

export const loadingBarStyles: SxProps = {
  width: '100%',
  height: '100%',
  borderRadius: 1,
  [`&.MuiLinearProgress-colorPrimary`]: {
    background: `linear-gradient(to right, ${Theme.palette.secondary.light},${Theme.palette.primary.light})`,
  },
  [`& .MuiLinearProgress-bar`]: {
    borderRadius: 0.6,
    background: `linear-gradient(to right, ${Theme.palette.primary.light},${Theme.palette.secondary.light})`,
  },
};

export const loadingBarTextStyles: SxProps = {
  ...centerFlex,
  flex: '0 1 20%',
  width: '100%',
};

export const loadingBarTextSxProps: SxProps = {
  fontSize: '2rem',
  [Theme.breakpoints.down('md')]: {
    fontSize: '1rem',
  },
};
