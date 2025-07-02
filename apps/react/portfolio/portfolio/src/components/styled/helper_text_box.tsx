import { styled } from '@mui/material-pigment-css';
import Box from '@mui/material-pigment-css/Box';
import type { ComponentType, ReactNode } from 'react';

interface HelperTextBoxProps {
  multiline: boolean;
  children: ReactNode;
}

const HelperTextBox: ComponentType<HelperTextBoxProps> = styled(Box, {
  shouldForwardProp: prop => prop !== 'multiline',
})<HelperTextBoxProps>(() => ({
  width: '100%',
  variants: [
    {
      props: { multiline: true },
      style: { height: '158px' },
    },
    {
      props: { multiline: false },
      style: { height: '78px' },
    },
  ],
}));

// HelperTextBox.displayName = 'Helper Text Box';

export default HelperTextBox;
