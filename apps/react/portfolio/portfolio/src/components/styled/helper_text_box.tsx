import Box, { type BoxProps } from '@mui/material/Box';
import { styled } from '@mui/material/styles';
import type { ComponentType } from 'react';

const HelperTextBox: ComponentType<BoxProps> = styled(Box)(() => ({
  height: '78px',
  width: '100%',
}));

export default HelperTextBox;
