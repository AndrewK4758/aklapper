import { styled } from '@mui/material/styles';
import Box from '@mui/material/Box';
import type { ComponentType, ReactNode } from 'react';

interface HelperTextBoxProps {
  multiline: boolean;
  children: ReactNode;
}

export const HelperTextBox: ComponentType<HelperTextBoxProps> = styled(Box, {
  shouldForwardProp: prop => prop !== 'multiline',
})<HelperTextBoxProps>(({ multiline }) => ({
  width: '100%',
  height: multiline ? '158px' : '78px',
}));

export default HelperTextBox;
