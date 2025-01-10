import type { SxProps } from '@mui/material/styles';
import Theme from './theme';

export const baseStyleForLayoutItems: SxProps = {
  flex: '1 0 100%',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  width: '100vw'
};

export const headerHeightSxProps: SxProps = {
  height: '5.8vh',
  maxHeight: '120px',
  minHeight: 'fit-content',
  width: '100vw'
};

export const headerWrapperSxProps: SxProps = {
  ...headerHeightSxProps,
  position: 'fixed',
  zIndex: 5,
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
  marginTop: '9vh',
  gap: '4.5vh',
  [Theme.breakpoints.down('lg')]: {
    marginTop: '5.25vh',
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
  height: 'fit-content',
  width: '100%',
  textAlign: 'center'
};
