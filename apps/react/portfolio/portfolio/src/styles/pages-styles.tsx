import type { SxProps } from '@mui/material/styles';
import Theme from './themes/theme.js';

export const flexColumnStyles: SxProps<typeof Theme> = { display: 'flex', flexDirection: 'column' };

export const pagesWrapperStyles: SxProps = {
  flex: '1 0 100%',
  display: 'flex',
  flexDirection: 'column',
  gap: '10vh',
  alignItems: 'center',
  height: 'fit-content',
  minHeight: '80vh',
  width: '100vw',
  [Theme.breakpoints.down('lg')]: {
    gap: '2vh',
  },
};

export const centerFlex: SxProps = {
  display: 'flex',
  alignContent: 'center',
  justifyContent: 'center',
};

export const pagesTitlesBoxStyles: SxProps = {
  ...centerFlex,
  paddingY: 2,
};

export const iconStateStyle = (state: 'loading' | 'idle' | 'submitting'): SxProps => ({
  opacity: state !== 'idle' ? 0.38 : 1,
  scale: 1.75,
  [Theme.breakpoints.down('lg')]: {
    scale: 1.25,
  },
});

export const buttonSXProps: SxProps = {
  // display: 'flex',
  [Theme.breakpoints.down('md')]: {
    fontSize: '1rem',
  },
};

export const pagesToolbarStyles: SxProps = {
  display: 'flex',
  flex: '0 1 100%',
};

export const modalButtonBoxStyles: SxProps = {
  display: 'flex',
  flex: '0 1 100%',
  justifyContent: 'flex-end',
  alignItems: 'center',
};

export const pagesOutletStyles: SxProps = {
  display: 'flex',
  justifyContent: 'center',
  width: '100%',
  minHeight: '100%',
  height: 'fit-content',
};

export const fullSizeBlock: SxProps = { height: '100%', width: '100%' };

export const headerModalButtonStyles: SxProps = {
  textAlign: 'right',
  color: Theme.palette.secondary.light,
  fontSize: '1.25rem',
};

export const pagesTitleSx: SxProps = {
  textAlign: 'center',
  flex: '1 0 100%',
  [Theme.breakpoints.down('lg')]: {
    fontSize: '2rem',
  },
};

export const gamesOutletWrapperSxProps = (state: 'loading' | 'idle' | 'submitting') =>
  state !== 'idle'
    ? {
        width: '100%',
        flex: '0 1 20%',
        [Theme.breakpoints.down('md')]: {
          flex: '0 1 10%',
        },
      }
    : ({
        display: 'none',
      } as SxProps);

export const gamesOutletGameWrapperSxProps: SxProps = {
  width: '100%',
  flex: '0 1 80%',
  display: 'flex',
  alignContent: 'center',
  justifyContent: 'center',
  [Theme.breakpoints.down('md')]: {
    flex: '0 1 90%',
  },
};

export const tooltipSx: SxProps = {
  color: Theme.palette.primary.main,
  backgroundColor: Theme.palette.background.paper,
  fontFamily: 'monospace',
};

export const errorTextSx: SxProps = {
  color: Theme.palette.error.main,
  backgroundColor: Theme.palette.background.paper,
  borderRadius: 1,
  paddingX: 1,
  fontSize: '1rem',
  fontFamily: 'monospace',
  textAlign: 'center',
  [Theme.breakpoints.down('md')]: {
    fontSize: '0.875rem',
  },
};
