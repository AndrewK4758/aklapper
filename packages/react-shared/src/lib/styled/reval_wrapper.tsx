import { styled } from '@mui/material/styles';
import Box from '@mui/material/Box';
import type { ComponentType, ReactNode } from 'react';

export interface RevealWrapperProps {
  isOpen: boolean;
  children: ReactNode;
}

export const RevealWrapper: ComponentType<RevealWrapperProps> = styled(Box, {
  shouldForwardProp: prop => prop !== 'isOpen',
})<RevealWrapperProps>(({ isOpen }) => ({
  height: '100%',
  transition: `width 0.35s ease-in-out`,
  overflow: 'hidden',
  width: isOpen ? '100%' : '0%',
}));
