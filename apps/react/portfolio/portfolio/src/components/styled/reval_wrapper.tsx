import Box, { type BoxProps } from '@mui/material/Box';
import { styled } from '@mui/material/styles';
import type { ComponentType } from 'react';

export interface RevealWrapperProps extends BoxProps {
  isOpen: boolean;
}

const RevealWrapper: ComponentType<RevealWrapperProps> = styled(Box, {
  shouldForwardProp: prop => prop !== 'isOpen',
})<RevealWrapperProps>(({ isOpen }) => ({
  height: '100%',
  width: isOpen ? '100%' : '0%',
  transition: `width 0.35s ease-in-out`,
  overflow: 'hidden',
}));

export default RevealWrapper;
