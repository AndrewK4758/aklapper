import type { SxProps } from '@mui/material/styles';
import type { CSSProperties } from 'react';
import { centerFlex, flexColumnStyles } from './pages-styles.jsx';
import Theme from './themes/theme.js';

//-------IMAGE FORM--------//

export const labelSx: SxProps = {
  color: Theme.palette.primary.main,
  width: 'fit-content',
  '&:hover': { cursor: 'pointer' },
  [Theme.breakpoints.down('md')]: {
    fontSize: '1.5rem',
  },
};

export const tooltipSx: SxProps = {
  maxWidth: '80vw',
  fontSize: '1rem',
  [Theme.breakpoints.down('md')]: {
    fontSize: '0.75rem',
  },
};

export const promptBuilderTextFieldSlotProps = {
  htmlInput: { sx: { fontSize: '0.75rem' } },
};

export const topLevelModeStyle: SxProps = {
  minHeight: '100%',
  height: 'fit-content',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  borderRadius: 1,
  width: '60vw',
  [Theme.breakpoints.down('md')]: {
    width: '90vw',
  },
};

export const genAiTextInputButtonSxProps: SxProps = {
  fontSize: '2rem',
  [Theme.breakpoints.down('md')]: {
    fontSize: '1rem',
  },
};

export const renderPreTagInsideParentDiv: SxProps | CSSProperties = {
  width: '100%',
  height: 'fit-content',
  minHeight: '10vh',
  overflow: 'hidden',
  whiteSpace: 'pre-wrap',
};

export const promptBuilderPaperSxProps: SxProps = { height: 'fit-content', minHeight: '30vh', width: '100%' };

export const coloredTitleStyles: SxProps = { textAlign: 'center' };

export const genAiImageHeaderBoxSxProps: SxProps<typeof Theme> = {
  ...flexColumnStyles,
  gap: 4,
  [Theme.breakpoints.down('md')]: {
    gap: 1,
  },
};

export const genAiAudioIconButtonSxProps: SxProps = {
  scale: 2,
  [Theme.breakpoints.down('md')]: {
    scale: 1,
  },
};
