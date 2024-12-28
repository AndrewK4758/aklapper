import type { SxProps } from '@mui/material/styles';
import Theme from './theme';

export const pagesWrapperStyles: SxProps = {
  flex: '1 0 100%',
  display: 'flex',
  flexDirection: 'column',
  gap: '10vh',
  alignItems: 'center',
  height: 'fit-content',
  minHeight: '80vh',
  width: '100vw'
};

export const centerFlex: SxProps = {
  display: 'flex',
  alignContent: 'center',
  justifyContent: 'center'
};

export const pagesTitlesBoxStyles: SxProps = {
  ...centerFlex,
  paddingY: 2
};

export const iconStateStyle = (state: 'loading' | 'idle' | 'submitting'): SxProps => ({
  opacity: state !== 'idle' ? 0.38 : 1,
  scale: 1.75
});

export const pagesToolbarStyles: SxProps = { display: 'flex', justifyContent: 'space-evenly', flex: '0 1 100%' };

export const modalButtonBoxStyles: SxProps = {
  display: 'flex',
  flex: '0 1 100%',
  justifyContent: 'flex-end',
  alignItems: 'center'
};

export const pagesOutletStyles: SxProps = {
  display: 'flex',
  justifyContent: 'center',
  width: '100%',
  minHeight: '100%',
  height: 'fit-content'
};

export const fullPageModalStyles: SxProps = {
  height: '100vh',
  width: '100vw',
  position: 'fixed',
  top: 0,
  left: 0,
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  overflowY: 'auto'
};

export const fullSizeBlock: SxProps = { height: '100%', width: '100%' };

export const headerModalButtonStyles: SxProps = {
  textAlign: 'right',
  color: Theme.palette.secondary.light,
  fontSize: '1.25rem'
};

export const pagesTitleSx: SxProps = {
  // fontSize: '15rem',
  textAlign: 'center',
  flex: '1 0 100%'
};
