import type { SxProps } from '@mui/material/styles';
import type { CSSProperties } from 'react';
import { centerFlex, flexColumnStyles } from './pages-styles.jsx';
import Theme from './themes/theme.js';

//-------IMAGE FORM--------//

export const helperTextSx: SxProps = {
  color: Theme.palette.error.main,
  fontSize: '1.25rem',
  [Theme.breakpoints.down('md')]: {
    fontSize: '1rem',
  },
};

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

export const textInputSx: SxProps = {
  width: '100%',
  borderRadius: 1,
  [Theme.breakpoints.down('md')]: {
    fontSize: '0.875rem',
  },
};

export const genAiImageDetailsBoxSxProps: SxProps = {
  ...centerFlex,
  justifyContent: 'space-around',
  [Theme.breakpoints.down('md')]: {
    justifyContent: 'space-between',
  },
};

export const promptBuilderTextFieldSlotProps = {
  htmlInput: { sx: { fontSize: '0.75rem' } },
};

export const sampleCountRadioTextStyles: SxProps = {
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'center',
};

export const forrmControlLabelStyles: SxProps = {
  alignContent: 'center',
  fontSize: '1.5rem',
  [Theme.breakpoints.down('md')]: {
    width: 'fit-content',
    justifyContent: 'center',
  },
};

export const radioGroupStyles: SxProps = {
  fontSize: '1.5rem',
  display: 'flex',
  flexDirection: 'row',
  gap: 4,
  paddingLeft: 2,
  [Theme.breakpoints.down('md')]: {
    p: 0,
    flexWrap: 'wrap',
    flex: '0 1 70%',
  },
};

export const genAiSampleCountTextSxProps: SxProps = {
  [Theme.breakpoints.down('md')]: {
    fontSize: '1rem',
  },
};

export const genAiImageSampleCountRadioSxProps: SxProps = {
  fontSize: '1rem',
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

export const promptBuilderResponseFormatLabelSxProps: SxProps = {
  color: Theme.palette.primary.main,
  [Theme.breakpoints.down('md')]: {
    fontSize: '1.5rem',
  },
};

export const radioButtonLabelSxProps: SxProps = {
  display: 'flex',
  flexDirection: 'row',
  gap: 2,
  alignItems: 'center',
  [Theme.breakpoints.down('md')]: {
    fontSize: '1rem',
  },
};
export const formLabelSxProps: SxProps = {
  alignContent: 'center',
  fontSize: '1.5rem',
  [Theme.breakpoints.down('md')]: {
    fontSize: '1rem',
  },
};
export const coloredTitleStyles: SxProps = { textAlign: 'center' };

export const promptBuillderFormBoxSxProps: SxProps<typeof Theme> = {
  ...flexColumnStyles,
  gap: 2,
  [Theme.breakpoints.down('md')]: {
    gap: 1,
  },
};

export const radioButtonLabelWrapperSxProps: SxProps = { display: 'flex', alignItems: 'center', gap: 2 };

export const promptBuilderResponseFormatBoxSxProps: SxProps = {
  borderRadius: 1,
};

export const promptBuilderRadioGroupSxProps: SxProps = {
  display: 'flex',
  flexDirection: 'row',
  justifyContent: 'space-around',
  paddingLeft: 2,
  [Theme.breakpoints.down('md')]: {
    paddingLeft: 0,
  },
};

export const promptBuilderResponseFormatIconsSxProps: SxProps = {
  scale: 1.5,
  color: Theme.palette.primary.main,
  [Theme.breakpoints.down('md')]: {
    scale: 1,
  },
};

export const promptBuilderUploadFileTextSxProps: SxProps = {
  [Theme.breakpoints.down('md')]: {
    fontSize: '1rem',
  },
};

export const genAiImageHeaderBoxSxProps: SxProps<typeof Theme> = {
  ...flexColumnStyles,
  gap: 4,
  [Theme.breakpoints.down('md')]: {
    gap: 1,
  },
};
export const genAiSliderInputSlotProps = {
  input: {
    'aria-labelledby': 'seed-slider',
    sx: { textAlign: 'center', fontSize: '1.5rem', color: Theme.palette.primary.main },
  },
};

export const genAiGenerateImageButtonBoxSxProps: SxProps = {
  ...centerFlex,
  flex: '0 1 50%',
  height: 'fit-content',
  [Theme.breakpoints.down('md')]: { flex: '1 0 100%' },
};

export const genAiAudioIconButtonSxProps: SxProps = {
  scale: 2,
  [Theme.breakpoints.down('md')]: {
    scale: 1,
  },
};
