import Box, { type BoxProps } from '@mui/material/Box';
import { keyframes, styled } from '@mui/material/styles';
import type { ComponentType } from 'react';
import { MAIN_COLOR, SECONDARY_COLOR } from '../../styles/base/base_styles';

export const spin = keyframes`
  50% {
    --clr-1: ${SECONDARY_COLOR};
    --clr-2: ${MAIN_COLOR};
    --clr-1: ${SECONDARY_COLOR};
  }`;

const AnimatedBorderBox: ComponentType<BoxProps> = styled(Box)(({ theme }) => ({
  background: `conic-gradient(${theme.palette.background.paper} 0 0) padding-box,
      linear-gradient(to right, var(--clr-1), var(--clr-2), var(--clr-1)) border-box`,
  border: '3px solid transparent',
  borderRadius: '10px',
  position: 'relative',
  isolation: 'isolate',
  animation: `${spin} 3s linear infinite`,
}));

export default AnimatedBorderBox;
