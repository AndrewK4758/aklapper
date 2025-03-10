import type { SxProps } from '@mui/material/styles';
import { flexColumnStyles } from './pages-styles.jsx';
import Theme from './theme.jsx';

export const baseStyleForHomeItems: SxProps = {
  width: '100vw',
  display: 'flex'
};

export const introWrapperSxProps: SxProps = {
  ...baseStyleForHomeItems,
  alignSelf: 'center',
  alignContent: 'space-between',
  gap: '2.5vw',
  width: '90vw',
  [Theme.breakpoints.down('lg')]: {
    flexDirection: 'column-reverse'
  }
};

export const introCardSxProps: SxProps = {
  flex: '0 1 70%',
  height: 'fit-content'
};

export const introTitleTextSxProps: SxProps = {
  borderBottom: `3px solid ${Theme.palette.divider}`,
  width: 'fit-content',
  alignSelf: 'center',
  [Theme.breakpoints.down('lg')]: {
    justifySelf: 'center',
    fontSize: '2.5rem'
  }
};

export const introTextSxProps: SxProps = {
  flex: '0 1 75%',
  fontSize: '1.25rem',
  fontFamily: 'Lucida',
  paddingTop: 4,
  [Theme.breakpoints.down('lg')]: {
    fontSize: '1rem',
    paddingTop: 1.5
  },
  '& .bold-text': {
    fontWeight: 'bolder'
  }
};

export const picAndResumeCardStyles: SxProps = {
  ...flexColumnStyles,
  flex: '0 1 30%',
  height: '100%',
  alignItems: 'center',
  justifyItems: 'space-evenly'
};

export const introPicStyles: SxProps = {
  width: '90%',
  paddingTop: 3,
  height: 'auto'
};

export const introIconSxProps: SxProps = {
  scale: 1.5,
  [Theme.breakpoints.down('lg')]: {
    scale: 1
  }
};

export const introButtonSxProps: SxProps = {
  [Theme.breakpoints.down('lg')]: {
    fontSize: '1rem'
  }
};

export const techListSectionContainer: SxProps = {
  flex: '1 0 25%',
  paddingY: 2,
  borderTop: `2px solid ${Theme.palette.primary.dark}`
};

export const techlistTextStyle: SxProps = {
  borderBottom: `2px solid ${Theme.palette.primary.dark}`,
  width: 'fit-content'
};
