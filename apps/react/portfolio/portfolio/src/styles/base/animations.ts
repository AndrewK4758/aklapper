import { keyframes } from '@mui/material-pigment-css';
import { MAIN_COLOR, SECONDARY_COLOR } from './base_styles';

export const spin = keyframes`
  50% {
    --clr-1: ${SECONDARY_COLOR};
    --clr-2: ${MAIN_COLOR};
    --clr-1: ${SECONDARY_COLOR};
  }`;
