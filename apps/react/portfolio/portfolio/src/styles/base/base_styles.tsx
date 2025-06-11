import { keyframes, type CSSObject } from '@mui/material/styles';

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

export const spin = keyframes`
  50% {
    --clr-1: ${SECONDARY_COLOR};
    --clr-2: ${MAIN_COLOR};
    --clr-1: ${SECONDARY_COLOR};
  }`;

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

  '.animated-border': {
    background: `conic-gradient(${BACKGROUND_PAPER} 0 0) padding-box,
    linear-gradient(to right, var(--clr-1), var(--clr-2), var(--clr-1)) border-box`,
    border: '3px solid transparent',
    borderRadius: '10px',
    position: 'relative',
    isolation: 'isolate',
    animation: `${spin} 3s linear infinite`,
  },
  '*': { border: '3px solid #9090c0' },
};

export default cssBaselineStyles;
