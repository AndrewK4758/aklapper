import type { SxProps } from '@mui/material/styles';
import { GamesTheme as Theme } from './games-theme';

export const breakpointsFooter: SxProps = {
  textAlign: 'center',
  alignContent: 'center',
  [Theme.breakpoints.down('md')]: {
    display: 'none',
  },
};

export const breakpointsFooterText: SxProps = {
  fontFamily: 'Jersey25-Charted',
  fontSize: '2.5rem',
  width: '100%',
  [Theme.breakpoints.down('md')]: {
    display: 'none',
  },
};

export const breakpointsMain: SxProps = {
  flex: 1,
  paddingY: 3,
  display: 'flex',
  flexDirection: 'column',
  [Theme.breakpoints.down('md')]: {},
};
