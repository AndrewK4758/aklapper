import { styled } from '@mui/material-pigment-css';
import Box from '@mui/material-pigment-css/Box';
import type { ComponentType, ReactNode } from 'react';

export interface RevealWrapperProps {
  isOpen: boolean;
  children: ReactNode;
}

export const RevealWrapper: ComponentType<RevealWrapperProps> = styled(Box, {
  shouldForwardProp: prop => prop !== 'isOpen',
})<RevealWrapperProps>(() => ({
  height: '100%',
  transition: `width 0.35s ease-in-out`,
  overflow: 'hidden',
  variants: [
    {
      props: { isOpen: true },
      style: { width: '100%', visibility: 'visible' },
    },
    {
      props: { isOpen: false },
      style: { width: '0%', visibility: 'hidden' },
    },
  ],
}));
