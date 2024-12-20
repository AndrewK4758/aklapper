import type { SxProps } from '@mui/material/styles';
import Theme from './theme';
import { flexColumnStyles } from './prompt-builder-styles';

export const baseStyleForHomeItems: SxProps = {
  width: '100vw',
  display: 'flex'
};

export const introCardSxProps: SxProps = {
  flex: '0 1 70%',
  height: 'fit-content'
};

export const introTitleTextSxProps: SxProps = {
  borderBottom: `3px solid ${Theme.palette.divider}`,
  width: 'fit-content',
  alignSelf: 'center'
};

export const introTextSxProps: SxProps = {
  flex: '0 1 75%',
  fontSize: '1.25rem',
  paddingTop: 4
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

export const techListSectionContainer: SxProps = {
  flex: '1 0 25%',
  paddingY: 2,
  borderTop: `2px solid ${Theme.palette.primary.dark}`
};

export const techlistTextStyle: SxProps = {
  borderBottom: `2px solid ${Theme.palette.primary.dark}`,
  width: 'fit-content'
};
