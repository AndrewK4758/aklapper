import { type CSSObject } from '@mui/material/styles';

/* Colors */

// Backgrounds
export const BACKGROUND_DEFAULT = '#323232';
export const BACKGROUND_PAPER = '#0C130E';
export const BACKGROUND_ALT = '#242424';

// Main
export const MAIN_COLOR = '#FFD300';
export const MAIN_COLOR_DARK = '#FFAA00';
export const MAIN_COLOR_LIGHT = '#FFFF00';
export const MAIN_CONTRAST = '#7109AA';

//Secondary
export const SECONDARY_COLOR = '#FF3D00';
export const SECONDARY_COLOR_DARK = '#AF320B';
export const SECONDARY_COLOR_LIGHT = '#D36947';
export const SECONDARY_CONTRAST = '#00B358';

// Text
export const TEXT_PRIMARY = '#EEF0FF';
export const TEXT_SECONDARY = '#E9E9EB';

// Transparent Box Shadow
export const BOX_SHADOW_MAIN_DARK = `0 0 0 0.5rem ${MAIN_COLOR_DARK}3A`;
export const BOX_SHADOW_SECONDARY_DARK = `0 0 0 0.5rem ${SECONDARY_COLOR_DARK}4A`;

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
  WebkitFontSmoothing: 'antialiased',
  '&:-webkit-autofill, &:-webkit-autofill:hover, &:-webkit-autofill:focus, &:-webkit-autofill:active': {
    WebkitTextFillColor: `var(${TEXT_PRIMARY}) !important`,
    WebkitBoxShadow: `0 0 0 100px ${BACKGROUND_PAPER} inset !important`,
    WebkitBackgroundClip: 'text',
  },
  'input::-webkit-inner-spin-button, & input::-webkit-outer-spin-button': {
    WebkitAppearance: 'none',
    margin: 0,
  },
  pre: {
    maxWidth: '100%',
    whiteSpace: 'pre-wrap',
    wordWrap: 'break-word',
  },

  '.floater::after': {
    content: '""',
    display: 'table',
    clear: 'both',
  },

  '.bold-text': {
    fontFamily: 'Lucida Bold',
  },

  '.contact-form': {
    width: '100%',
  },

  //Find better solution
  '& .MuiClock-meridiemText': {
    // color: MAIN_CONTRAST,
  },

  // '*': { border: '3px solid #9090c0' },
};

export default cssBaselineStyles;
