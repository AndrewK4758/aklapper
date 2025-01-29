import { SxProps } from '@mui/material';
import GamesTheme from './games-theme';

export const breakpointsTextBoxSx: SxProps = {
  backgroundColor: GamesTheme.palette.info.main,
  width: '30vw',
  height: '5vw',
  justifySelf: 'center',
  alignSelf: 'center',
  p: 0,
  m: 0,
  fontSize: '2rem',
  borderRadius: '5px',
  [GamesTheme.breakpoints.down('md')]: {
    fontSize: '17px',
    textAlign: 'center',
    height: 35,
    width: 230
  }
};

export const breakpointsButtonSx: SxProps = {
  backgroundColor: GamesTheme.palette.info.main,
  [GamesTheme.breakpoints.down('md')]: {
    fontSize: '17px',
    width: 130,
    height: 25
  }
};

export const breakpointsLabelSx: SxProps = {
  color: GamesTheme.palette.primary.main,
  textShadow: `1px 1px 1px #800080`
};
