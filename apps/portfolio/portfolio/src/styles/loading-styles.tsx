import linearProgressClasses from '@mui/material/LinearProgress/linearProgressClasses';
import type { SxProps } from '@mui/material/styles';
import Theme from './theme';
import { centerFlex, flexColumnStyles } from './pages-styles';

export const loadingPaperStyles: SxProps = {
  ...flexColumnStyles,
  width: '100vw',
  height: '100%',
  justifyContent: 'center'
};

export const loadingBarBox: SxProps = {
  flex: '0 1 80%'
};

export const loadingBarStyles: SxProps = {
  width: '100%',
  height: '100%',
  borderRadius: 1,
  [`&.${linearProgressClasses.colorPrimary}`]: {
    background: `linear-gradient(to right, ${Theme.palette.secondary.light},${Theme.palette.primary.light})`
  },
  [`& .${linearProgressClasses.bar}`]: {
    borderRadius: 0.6,
    background: `linear-gradient(to right, ${Theme.palette.primary.light},${Theme.palette.secondary.light})`
  }
};

export const loadingBarTextStyles: SxProps = {
  ...centerFlex,
  flex: '0 1 20%',
  width: '100%'
};

export const loadingBarTextSxProps: SxProps = {
  fontSize: '2rem',
  [Theme.breakpoints.down('md')]: {
    fontSize: '1rem'
  }
};
