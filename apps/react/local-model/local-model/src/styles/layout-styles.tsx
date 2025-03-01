import type { SxProps } from '@mui/material/styles';
import Theme from './theme';

export const baseStyleForLayoutItems: SxProps = {
  flex: '0 1 100%',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  width: '100vw'
};

export const headerHeightSxProps: SxProps = {
  flex: '0 1 9%',
  width: '100vw'
};

export const headerWrapperSxProps: SxProps = {
  ...headerHeightSxProps,
  position: 'static',
  zIndex: 5,
  border: 5,
  [Theme.breakpoints.down('lg')]: {}
};

export const homeWrapperSxProps: SxProps = {
  ...baseStyleForLayoutItems,
  position: 'relative',
  height: '100vh',
  flex: '1 0 100%',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: '25vh'
};

export const mainWrapperSxProps: SxProps = {
  ...baseStyleForLayoutItems,
  border: '5px solid hotpink',
  flex: '1 0 100%',
  gap: '4.5vh',
  [Theme.breakpoints.down('lg')]: {
    gap: '2.25vh'
  }
};

export const outletWrapperSxProps: SxProps = {
  ...baseStyleForLayoutItems,
  height: 'fit-content',
  minHeight: '50vh',
  paddingBottom: '15vh',
  [Theme.breakpoints.down('lg')]: {
    paddingBottom: '8vh'
  }
};

export const footerWrapperSxProps: SxProps = {
  flex: '0 1 5%',
  width: '100%',
  textAlign: 'center'
};
