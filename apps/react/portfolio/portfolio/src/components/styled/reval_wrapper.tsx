import { styled } from '@mui/material-pigment-css';
import Box from '@mui/material-pigment-css/Box';
import type { ComponentType } from 'react';

export interface RevealWrapperProps {
  isOpen: boolean;
}

const RevealWrapper: ComponentType<RevealWrapperProps> = styled(Box, {
  shouldForwardProp: prop => prop !== 'isOpen',
})<RevealWrapperProps>(() => ({
  height: '100%',
  transition: `width 0.35s ease-in-out`,
  overflow: 'hidden',
  variants: [
    {
      props: { isOpen: true },
      style: { width: '100%' },
    },
    {
      props: { isOpen: false },
      style: { width: '0%' },
    },
  ],
}));

// RevealWrapper.displayName = 'Reveal Wrapper';

export default RevealWrapper;
