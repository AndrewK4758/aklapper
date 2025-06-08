import type { CSSObject } from '@mui/material/styles';

// Backgrounds
export const BACKGROUND_DEFAULT = '#323232';
export const BACKGROUND_PAPER = '#111321';

// Colors
export const MAIN_COLOR = '#FFD300';
export const MAIN_CONTRAST = '#7109AA';
export const SECONDARY_COLOR = '#FF3D00';
export const SECONDARY_CONTRAST = '#0969A2';

// Text
export const TEXT_PRIMARY = '#EEF0FF';
export const TEXT_SECONDARY = '#E9E9EB';

const darkScrollbarGlobal = {
  '&::-webkit-scrollbar': {
    width: '0.75rem',
  },
  '&::-webkit-scrollbar-track': {
    background: `linear-gradient(to bottom, #ffd300, #ff3d00)`,
  },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: '#3a3c41',
    borderRadius: '2px',
  },
};

const cssBaselineStyles: CSSObject = {
  ...darkScrollbarGlobal,

  fontSynthesis: 'none',
  textRendering: 'optimizeLegibility',
  boxSizing: 'border-box',
  overflowX: 'hidden',
  '-webkit-font-smoothing': 'antialiased',
  '&:-webkit-autofill, &:-webkit-autofill:hover, &:-webkit-autofill:focus, &:-webkit-autofill:active': {
    '-webkit-text-fill-color': `var(${TEXT_PRIMARY}) !important`,
    '-webkit-box-shadow': `0 0 0 100px ${BACKGROUND_PAPER} inset !important`,
    '-webkit-background-clip': 'text',
  },
  'input::-webkit-inner-spin-button, & input::-webkit-outer-spin-button': {
    '-webkit-appearance': 'none',
    margin: 0,
  },
  pre: {
    maxWidth: '100%',
    whiteSpace: 'pre-wrap',
    wordWrap: 'break-word',
  },

  '.floater::after': {
    content: '',
    display: 'table',
    clear: 'both',
  },

  '.bold-text': {
    fontFamily: 'Lucida Bold',
  },
  '*': { border: '3px solid #ff8800' },

  '.explosion-animation': {
    opacity: 1,
    transition: 'opacity 0.8s ease-in-out',
  },

  '.explosion-animation.hide': {
    opacity: 0,
  },

  '@keyframes shake': {
    '1.25%, 11.25%': {
      transform: 'rotateZ(-0.75deg)',
    },
    '2.5%, 10%': {
      transform: 'rotateZ(1.5deg)',
    },
    '3.75%, 6.75%, 8.75%': {
      transform: 'rotateZ(-3deg)',
    },
    '5%, 7.5%': {
      transform: 'rotateZ(3deg)',
    },
    '11.5%': {
      transform: 'rotateZ(0deg)',
    },
    '100%': {
      transition: 'rotateZ(0deg)',
    },
  },
};

export default cssBaselineStyles;
/**
  
 */
