import { keyframes } from '@mui/material-pigment-css';
import { MAIN_COLOR, SECONDARY_COLOR } from './base_styles';

export const spin = keyframes`
  50% {
    --clr-1: ${SECONDARY_COLOR};
    --clr-2: ${MAIN_COLOR};
    --clr-1: ${SECONDARY_COLOR};
  }`;

export const shake = keyframes`
  1.25%,
  11.25% {
    transform: rotateZ(-0.75deg);
  }
  2.5%,
  10% {
    transform: rotateZ(1.5deg);
  }
  3.75%,
  6.75%,
  8.75% {
    transform: rotateZ(-3deg);
  }
  5%,
  7.5% {
    transform: rotateZ(3deg);
  }
  11.5% {
    transform: rotateZ(0deg);
  }
  100% {
    transition: rotateZ(0deg);
  }
`;
