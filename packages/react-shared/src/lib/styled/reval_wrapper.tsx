import Box from '@mui/material/Box';
import { styled } from '@mui/material/styles';
import type { ComponentType, ReactNode } from 'react';

export interface RevealWrapperProps {
  isOpen: boolean;
  children: ReactNode;
}

export const RevealWrapper: ComponentType<RevealWrapperProps> = styled(Box, {
  shouldForwardProp: prop => prop !== 'isOpen',
})<RevealWrapperProps>(({ isOpen }) => ({
  transition: `width 350ms linear`,
  overflow: 'hidden',
  width: isOpen ? '100%' : '0%',
}));
