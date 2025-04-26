import type { SxProps } from '@mui/material/styles';
import type { CSSProperties } from 'react';
import { GamesTheme } from './games-theme';

export const breakpointsTextBoxSx: SxProps = {
  backgroundColor: GamesTheme.palette.info.main,
  width: '30vw',
  height: '3vw',
  justifySelf: 'center',
  alignSelf: 'center',
  p: 0,
  m: 0,
  fontSize: '1.5rem',
  borderRadius: '5px',
  [GamesTheme.breakpoints.down('md')]: {
    fontSize: '17px',
    textAlign: 'center',
    height: 35,
    width: 230,
  },
};

export const breakpointsButtonSx: SxProps = {
  backgroundColor: GamesTheme.palette.info.main,
  [GamesTheme.breakpoints.down('md')]: {
    fontSize: '17px',
    width: 130,
    height: 25,
  },
};

export const breakpointsLabelSx: SxProps = {
  color: GamesTheme.palette.primary.main,
  textShadow: `1px 1px 1px #800080`,
};

export const inputStyle: CSSProperties = {
  fontSize: '1.5rem',
};
