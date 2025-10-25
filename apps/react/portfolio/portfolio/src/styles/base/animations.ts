import { keyframes } from '@mui/material/styles';
import { MAIN_COLOR, SECONDARY_COLOR } from './base_styles';

export const typewriter = keyframes`
from {
width: 0%;
}
to {
width: 100%;
}
`;

export const spin = keyframes`
  50% {
    --clr-1: ${SECONDARY_COLOR};
    --clr-2: ${MAIN_COLOR};
    --clr-1: ${SECONDARY_COLOR};
  }`;
