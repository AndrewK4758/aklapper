import { styled } from '@mui/material/styles';
import Box, { type BoxProps } from '@mui/material/Box';
import { spin } from '../../styles/base/animations';
import type { ComponentType } from 'react';

const AnimatedBorderBox: ComponentType<BoxProps> = styled(Box)(({ theme }) => ({
  background: `conic-gradient(${theme.palette.background.paper} 0 0) padding-box,
      linear-gradient(to right, var(--clr-1), var(--clr-2), var(--clr-1)) border-box`,
  border: '3px solid transparent',
  borderRadius: '22px',
  position: 'relative',
  isolation: 'isolate',
  animation: `${spin} 2s linear infinite`,
}));

export default AnimatedBorderBox;
