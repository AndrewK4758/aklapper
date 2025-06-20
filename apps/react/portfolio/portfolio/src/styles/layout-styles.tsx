import type { SxProps } from '@mui/material/styles';
import Theme from './themes/theme.js';

export const baseStyleForLayoutItems: SxProps = {
  flex: '1 0 100%',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  width: '100%',
};

export const homeWrapperSxProps: SxProps = {
  ...baseStyleForLayoutItems,
  position: 'relative',
  height: '100vh',
  flex: '1 0 100%',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: '25vh',
};

export const mainWrapperSxProps: SxProps = {
  ...baseStyleForLayoutItems,
  paddingTop: '4rem',
  // marginTop: '12vh',
  gap: '15vh',
  [Theme.breakpoints.down('lg')]: {
    // marginTop: '8vh',
    paddingTop: '4rem',
    gap: '5vh',
  },
};

export const outletWrapperSxProps: SxProps = {
  ...baseStyleForLayoutItems,
  height: 'fit-content',
  minHeight: '50vh',
  paddingBottom: '15vh',
  top: '100vh',
  [Theme.breakpoints.down('lg')]: {
    paddingBottom: '8vh',
  },
};

export const footerWrapperSxProps: SxProps = {
  height: 'fit-content',
  width: '100%',
  textAlign: 'center',
};
