import type { SxProps } from '@mui/material/styles';
import { GamesTheme as Theme } from './games-theme';

export const headerToolbarSx: SxProps = {
  display: 'flex',
  alignItems: 'stretch',
};

export const avatarWrapperSx: SxProps = {
  flex: '0 1 86px',
  display: 'flex',
  alignContent: 'center',
  justifyContent: 'center',
};

export const avatarStyleBoxSx: SxProps = {
  width: '100%',
  padding: '12.5%',
};

export const avatarSx: SxProps = {
  width: 'stretch',
  height: 'stretch',
  fontSize: '2.5rem',
};

export const titleText: SxProps = {
  textAlign: 'center',
  [Theme.breakpoints.down('md')]: {
    fontSize: '4rem',
  },
};
