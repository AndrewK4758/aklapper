import type { SxProps } from '@mui/material/styles';

export const baseStyleForLayoutItems: SxProps = {
  flex: '1 0 100%',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  width: '100vw'
};

export const headerWrapperSxProps: SxProps = {
  position: 'fixed',
  width: '100vw',
  display: 'flex',
  height: '8vh',
  maxHeight: '120px',
  alignContent: 'center',
  zIndex: 5
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
  marginTop: '12vh',
  gap: '15vh'
};

export const outletWrapperSxProps: SxProps = {
  ...baseStyleForLayoutItems,
  height: 'fit-content',
  minHeight: '50vh',
  paddingBottom: '15vh',
  top: '100vh'
};

export const footerWrapperSxProps: SxProps = {
  height: 'fit-content',
  width: '100%',
  textAlign: 'center'
};
