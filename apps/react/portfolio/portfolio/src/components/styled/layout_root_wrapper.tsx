import Box, { type BoxProps } from '@mui/material/Box';
import { styled } from '@mui/material/styles';
import type { ComponentType } from 'react';

const StyledRootComponentWrapper: ComponentType<BoxProps> = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  height: 'fit-content',
  minHeight: '100vh',
  gap: theme.spacing(2),
  border: theme.shape.borderRadius,
  padding: theme.spacing(2),
}));

export default StyledRootComponentWrapper;
